"""
Cash session routes: sessions, buy-ins, cash-outs, settlements.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_current_user, get_service_client
from models.schemas import (
    AddPlayerRequest,
    BuyinCreate,
    BuyinResponse,
    CashoutCreate,
    CashoutResponse,
    GuestPlayerCreate,
    PlayerInfo,
    SessionCreate,
    SessionResponse,
    SessionSummary,
    SettlementResponse,
)
from services.settlement import compute_settlements, get_session_summary, resolve_player_map
from services.cash_service import close_session_logic

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def require_host(session_id: str, user_id: str, db_client) -> dict:
    """
    Fetch the session and verify the caller is the host.
    Returns the session row on success; raises 403/404 otherwise.
    """
    resp = (
        db_client.table('cash_session')
        .select('*')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if resp.data['host_id'] != user_id:
        raise HTTPException(status_code=403, detail="Solo el host puede realizar esta acción")
    return resp.data


def _build_session_response(row: dict) -> SessionResponse:
    fecha = row.get('fecha')
    if isinstance(fecha, str):
        fecha = date.fromisoformat(fecha)
    return SessionResponse(
        id=row['id'],
        host_id=row['host_id'],
        grupo_id=row['grupo_id'],
        nombre=row['nombre'],
        fecha=fecha or date.today(),
        lugar=row.get('lugar'),
        estado=row['estado'],
        created_at=row['created_at'],
    )


# ---------------------------------------------------------------------------
# Session routes (sessions are created via POST /grupos/{id}/partidas)
# ---------------------------------------------------------------------------

@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(user=Depends(get_current_user)):
    """Return sessions where the user is host OR a registered player."""
    service = get_service_client()

    # Sessions where user is host
    host_resp = (
        service.table('cash_session')
        .select('*')
        .eq('host_id', user.id)
        .execute()
    )

    # Sessions where user is a player
    player_resp = (
        service.table('session_player')
        .select('session_id')
        .eq('player_id', user.id)
        .execute()
    )
    player_session_ids = [row['session_id'] for row in player_resp.data]

    seen_ids = {row['id'] for row in host_resp.data}
    all_sessions = list(host_resp.data)

    if player_session_ids:
        extra_ids = [sid for sid in player_session_ids if sid not in seen_ids]
        if extra_ids:
            extra_resp = (
                service.table('cash_session')
                .select('*')
                .in_('id', extra_ids)
                .execute()
            )
            all_sessions.extend(extra_resp.data)

    return [_build_session_response(row) for row in all_sessions]


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, user=Depends(get_current_user)):
    """Return a single session. User must be host or player."""
    service = get_service_client()

    resp = (
        service.table('cash_session')
        .select('*')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    session = resp.data

    # Verify access
    if session['host_id'] != user.id:
        player_resp = (
            service.table('session_player')
            .select('player_id')
            .eq('session_id', session_id)
            .eq('player_id', user.id)
            .execute()
        )
        if not player_resp.data:
            raise HTTPException(status_code=403, detail="Sin acceso a esta sesión")

    return _build_session_response(session)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, user=Depends(get_current_user)):
    """Delete a session and all its related data. Host only."""
    service = get_service_client()
    require_host(session_id, user.id, service)

    try:
        service.table('settlement').delete().eq('session_id', session_id).execute()
        service.table('cashout').delete().eq('session_id', session_id).execute()
        service.table('buyin').delete().eq('session_id', session_id).execute()
        service.table('session_player').delete().eq('session_id', session_id).execute()
        service.table('cash_session').delete().eq('id', session_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/sessions/{session_id}/players", response_model=list[PlayerInfo])
def list_players(session_id: str, user=Depends(get_current_user)):
    """Return all players in a session (real users + guests). Host only."""
    service = get_service_client()
    require_host(session_id, user.id, service)

    sp_resp = (
        service.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .execute()
    )
    player_ids = [row['player_id'] for row in sp_resp.data]

    player_map = resolve_player_map(player_ids, service)
    return [
        PlayerInfo(id=pid, **player_map.get(pid, {'nombre': pid, 'alias_pago': None, 'is_guest': False}))
        for pid in player_ids
    ]


@router.post("/sessions/{session_id}/players", status_code=201)
def add_player(session_id: str, body: AddPlayerRequest, user=Depends(get_current_user)):
    """Add a registered user to the session by their user UUID. Host only."""
    service = get_service_client()
    require_host(session_id, user.id, service)

    # Verify the player profile exists
    profile_resp = (
        service.table('profile')
        .select('user_id')
        .eq('user_id', body.player_id)
        .execute()
    )
    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Jugador registrado no encontrado")

    existing = (
        service.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .eq('player_id', body.player_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="El jugador ya está en la sesión")

    try:
        service.table('session_player').insert({
            'session_id': session_id,
            'player_id': body.player_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"detail": "Jugador agregado"}


@router.delete("/sessions/{session_id}/players/{player_id}", status_code=204)
def remove_player(session_id: str, player_id: str, user=Depends(get_current_user)):
    """Remove a player from an open session, deleting their buy-ins and cashout. Host only."""
    service = get_service_client()
    session = require_host(session_id, user.id, service)
    if session['estado'] != 'abierta':
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")
    service.table('buyin').delete().eq('session_id', session_id).eq('player_id', player_id).execute()
    service.table('cashout').delete().eq('session_id', session_id).eq('player_id', player_id).execute()
    service.table('session_player').delete().eq('session_id', session_id).eq('player_id', player_id).execute()


@router.delete("/buyins/{buyin_id}", status_code=204)
def delete_buyin(buyin_id: str, user=Depends(get_current_user)):
    """Delete a specific buy-in. Host only, session must be open."""
    service = get_service_client()
    buyin_resp = service.table('buyin').select('session_id').eq('id', buyin_id).single().execute()
    if not buyin_resp.data:
        raise HTTPException(status_code=404, detail="Buy-in no encontrado")
    session = require_host(buyin_resp.data['session_id'], user.id, service)
    if session['estado'] != 'abierta':
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")
    service.table('buyin').delete().eq('id', buyin_id).execute()


@router.post("/sessions/{session_id}/add-member", status_code=201)
def add_member(session_id: str, body: AddPlayerRequest, user=Depends(get_current_user)):
    """Add any player (registered or guest) to the session by player_id. Host only."""
    service = get_service_client()
    require_host(session_id, user.id, service)

    profile_resp = service.table('profile').select('user_id').eq('user_id', body.player_id).execute()
    guest_resp = service.table('guest_player').select('id').eq('id', body.player_id).execute()

    if not profile_resp.data and not guest_resp.data:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    existing = (
        service.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .eq('player_id', body.player_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="El jugador ya está en la sesión")

    try:
        service.table('session_player').insert({
            'session_id': session_id,
            'player_id': body.player_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"detail": "Jugador agregado"}


@router.post("/sessions/{session_id}/guests", response_model=PlayerInfo, status_code=201)
def add_guest_player(session_id: str, body: GuestPlayerCreate, user=Depends(get_current_user)):
    """Create a guest player and add them to the session in one step. Host only."""
    service = get_service_client()
    require_host(session_id, user.id, service)

    try:
        guest_resp = service.table('guest_player').insert({
            'host_id': user.id,
            'nombre': body.nombre,
            'alias_pago': body.alias_pago,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    guest = guest_resp.data[0]
    guest_id = guest['id']

    try:
        service.table('session_player').insert({
            'session_id': session_id,
            'player_id': guest_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return PlayerInfo(
        id=guest_id,
        nombre=guest['nombre'],
        alias_pago=guest.get('alias_pago'),
        is_guest=True,
    )


# ---------------------------------------------------------------------------
# Buy-in routes
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/buyins", response_model=BuyinResponse, status_code=201)
def create_buyin(session_id: str, body: BuyinCreate, user=Depends(get_current_user)):
    """Record a buy-in for a player. Host only."""
    service = get_service_client()
    session = require_host(session_id, user.id, service)

    if session['estado'] != 'abierta':
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    # Verify player is in session
    player_check = (
        service.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .eq('player_id', body.player_id)
        .execute()
    )
    if not player_check.data:
        raise HTTPException(status_code=400, detail="El jugador no está registrado en esta sesión")

    try:
        resp = service.table('buyin').insert({
            'session_id': session_id,
            'player_id': body.player_id,
            'monto': body.monto,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return BuyinResponse(**resp.data[0])


@router.get("/sessions/{session_id}/buyins", response_model=list[BuyinResponse])
def list_buyins(session_id: str, user=Depends(get_current_user)):
    """Return all buy-ins for a session."""
    service = get_service_client()

    # Verify session exists and user has access
    session_resp = (
        service.table('cash_session')
        .select('host_id')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    resp = (
        service.table('buyin')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at')
        .execute()
    )
    player_ids = list({row['player_id'] for row in resp.data})
    names = resolve_player_map(player_ids, service)
    return [
        BuyinResponse(**row, player_nombre=names.get(row['player_id'], {}).get('nombre'))
        for row in resp.data
    ]


# ---------------------------------------------------------------------------
# Cash-out routes
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/cashouts", response_model=CashoutResponse, status_code=201)
def create_cashout(session_id: str, body: CashoutCreate, user=Depends(get_current_user)):
    """Record or replace a cash-out for a player. Host only. Upsert behaviour."""
    service = get_service_client()
    session = require_host(session_id, user.id, service)

    if session['estado'] != 'abierta':
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    # Verify player is in session
    player_check = (
        service.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .eq('player_id', body.player_id)
        .execute()
    )
    if not player_check.data:
        raise HTTPException(status_code=400, detail="El jugador no está registrado en esta sesión")

    cashout_data = {
        'session_id': session_id,
        'player_id': body.player_id,
        'monto': body.monto,
    }

    # Check for existing cashout (UNIQUE constraint on session_id, player_id)
    existing_resp = (
        service.table('cashout')
        .select('id')
        .eq('session_id', session_id)
        .eq('player_id', body.player_id)
        .execute()
    )

    try:
        if existing_resp.data:
            existing_id = existing_resp.data[0]['id']
            resp = (
                service.table('cashout')
                .update({'monto': body.monto})
                .eq('id', existing_id)
                .execute()
            )
        else:
            resp = service.table('cashout').insert(cashout_data).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return CashoutResponse(**resp.data[0])


@router.get("/sessions/{session_id}/cashouts", response_model=list[CashoutResponse])
def list_cashouts(session_id: str, user=Depends(get_current_user)):
    """Return all cash-outs for a session."""
    service = get_service_client()

    session_resp = (
        service.table('cash_session')
        .select('host_id')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    resp = (
        service.table('cashout')
        .select('*')
        .eq('session_id', session_id)
        .execute()
    )
    player_ids = list({row['player_id'] for row in resp.data})
    names = resolve_player_map(player_ids, service)
    return [
        CashoutResponse(**row, player_nombre=names.get(row['player_id'], {}).get('nombre'))
        for row in resp.data
    ]


@router.delete("/sessions/{session_id}/cashouts/{player_id}", status_code=204)
def delete_cashout(session_id: str, player_id: str, user=Depends(get_current_user)):
    """Delete a player's cashout, moving them back to active. Host only."""
    service = get_service_client()
    session = require_host(session_id, user.id, service)

    if session['estado'] != 'abierta':
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    service.table('cashout').delete().eq('session_id', session_id).eq('player_id', player_id).execute()


# ---------------------------------------------------------------------------
# Close session
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/close", response_model=SessionResponse)
def close_session(session_id: str, user=Depends(get_current_user)):
    """
    Close a session. Host only.
    Validates all players have a cash-out, then computes settlements
    and marks the session as 'cerrada'.
    """
    service = get_service_client()
    updated_row = close_session_logic(session_id, user.id, service)
    return _build_session_response(updated_row)


# ---------------------------------------------------------------------------
# Session summary
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/summary", response_model=SessionSummary)
def session_summary(session_id: str, user=Depends(get_current_user)):
    """Return the full session summary: balances and settlements with names/aliases."""
    service = get_service_client()

    # Verify session exists and user has access
    session_resp = (
        service.table('cash_session')
        .select('host_id')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    if session_resp.data['host_id'] != user.id:
        player_check = (
            service.table('session_player')
            .select('player_id')
            .eq('session_id', session_id)
            .eq('player_id', user.id)
            .execute()
        )
        if not player_check.data:
            raise HTTPException(status_code=403, detail="Sin acceso a esta sesión")

    summary = get_session_summary(session_id, service)
    return SessionSummary(**summary)


# ---------------------------------------------------------------------------
# Settlement confirmation
# ---------------------------------------------------------------------------

@router.patch("/settlements/{settlement_id}/confirm", response_model=SettlementResponse)
def confirm_settlement(settlement_id: str, user=Depends(get_current_user)):
    """
    Confirm a settlement.
    - The debtor can confirm → estado becomes 'confirmado_deudor'.
    - The host of the session can confirm → estado becomes 'confirmado_host'.
    """
    service = get_service_client()

    settlement_resp = (
        service.table('settlement')
        .select('*')
        .eq('id', settlement_id)
        .single()
        .execute()
    )
    if not settlement_resp.data:
        raise HTTPException(status_code=404, detail="Settlement no encontrado")

    settlement = settlement_resp.data
    session_id = settlement['session_id']

    # Fetch session to know the host
    session_resp = (
        service.table('cash_session')
        .select('host_id')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    is_debtor = settlement['deudor_id'] == user.id
    is_host = session_resp.data['host_id'] == user.id

    if not is_debtor and not is_host:
        raise HTTPException(status_code=403, detail="No tiene permiso para confirmar este settlement")

    new_estado = 'confirmado_deudor' if is_debtor else 'confirmado_host'

    try:
        update_resp = (
            service.table('settlement')
            .update({'estado': new_estado})
            .eq('id', settlement_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    row = update_resp.data[0]

    # Enrich with profile data
    acreedor_resp = (
        service.table('profile')
        .select('nombre, alias_pago')
        .eq('user_id', row['acreedor_id'])
        .execute()
    )
    deudor_resp = (
        service.table('profile')
        .select('nombre')
        .eq('user_id', row['deudor_id'])
        .execute()
    )

    acreedor_profile = acreedor_resp.data[0] if acreedor_resp.data else {}
    deudor_profile = deudor_resp.data[0] if deudor_resp.data else {}

    return SettlementResponse(
        **row,
        alias_acreedor=acreedor_profile.get('alias_pago'),
        nombre_acreedor=acreedor_profile.get('nombre'),
        nombre_deudor=deudor_profile.get('nombre'),
    )
