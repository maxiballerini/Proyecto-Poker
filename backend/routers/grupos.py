"""
Grupos routes: persistent friend groups with members and partidas.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_current_user, get_service_client
from models.schemas import (
    GrupoCreate,
    GrupoDetail,
    GrupoResponse,
    GuestLinkRequest,
    GuestPlayerCreate,
    InviteInfo,
    PlayerInfo,
    SessionCreate,
    SessionResponse,
)
from services.settlement import resolve_player_map

router = APIRouter()


def _get_grupo_or_404(grupo_id: str, service) -> dict:
    resp = service.table('grupo').select('*').eq('id', grupo_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return resp.data


def _require_grupo_host(grupo_id: str, user_id: str, service) -> dict:
    grupo = _get_grupo_or_404(grupo_id, service)
    if grupo['host_id'] != user_id:
        raise HTTPException(status_code=403, detail="Solo el host puede realizar esta acción")
    return grupo


def _require_grupo_access(grupo_id: str, user_id: str, service) -> dict:
    """Allow host OR registered member."""
    grupo = _get_grupo_or_404(grupo_id, service)
    if grupo['host_id'] == user_id:
        return grupo
    member = service.table('grupo_member').select('player_id').eq('grupo_id', grupo_id).eq('player_id', user_id).execute()
    if not member.data:
        raise HTTPException(status_code=403, detail="No tenés acceso a este grupo")
    return grupo


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
# Grupo CRUD
# ---------------------------------------------------------------------------

@router.post("/grupos", response_model=GrupoResponse, status_code=201)
def create_grupo(body: GrupoCreate, user=Depends(get_current_user)):
    service = get_service_client()
    try:
        resp = service.table('grupo').insert({
            'host_id': user.id,
            'nombre': body.nombre,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    g = resp.data[0]
    return GrupoResponse(
        id=g['id'], host_id=g['host_id'], nombre=g['nombre'], created_at=g['created_at'],
        total_partidas=0, total_miembros=0,
    )


@router.get("/grupos/member", response_model=list[GrupoResponse])
def list_member_grupos(user=Depends(get_current_user)):
    """Groups where the current user is a member (but not host)."""
    service = get_service_client()
    member_resp = service.table('grupo_member').select('grupo_id').eq('player_id', user.id).execute()
    if not member_resp.data:
        return []
    grupo_ids = [m['grupo_id'] for m in member_resp.data]
    grupos_resp = service.table('grupo').select('*').in_('id', grupo_ids).neq('host_id', user.id).execute()
    result = []
    for g in grupos_resp.data:
        members_resp = service.table('grupo_member').select('player_id').eq('grupo_id', g['id']).execute()
        partidas_resp = service.table('cash_session').select('id').eq('grupo_id', g['id']).execute()
        result.append(GrupoResponse(
            id=g['id'], host_id=g['host_id'], nombre=g['nombre'], created_at=g['created_at'],
            total_miembros=len(members_resp.data),
            total_partidas=len(partidas_resp.data),
        ))
    return result


@router.get("/grupos", response_model=list[GrupoResponse])
def list_grupos(user=Depends(get_current_user)):
    service = get_service_client()
    grupos_resp = (
        service.table('grupo')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', desc=True)
        .execute()
    )

    result = []
    for g in grupos_resp.data:
        members_resp = service.table('grupo_member').select('player_id').eq('grupo_id', g['id']).execute()
        partidas_resp = service.table('cash_session').select('id').eq('grupo_id', g['id']).execute()
        result.append(GrupoResponse(
            id=g['id'], host_id=g['host_id'], nombre=g['nombre'], created_at=g['created_at'],
            total_miembros=len(members_resp.data),
            total_partidas=len(partidas_resp.data),
        ))
    return result


@router.get("/grupos/{grupo_id}", response_model=GrupoDetail)
def get_grupo(grupo_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    grupo_row = _require_grupo_access(grupo_id, user.id, service)

    members_resp = service.table('grupo_member').select('player_id').eq('grupo_id', grupo_id).execute()
    player_ids = [row['player_id'] for row in members_resp.data]
    player_map = resolve_player_map(player_ids, service)
    miembros = [
        PlayerInfo(id=pid, **player_map.get(pid, {'nombre': pid, 'alias_pago': None, 'is_guest': False}))
        for pid in player_ids
    ]

    # Host always appears first in the list
    host_id = grupo_row['host_id']
    if not any(m.id == host_id for m in miembros):
        host_profile = service.table('profile').select('user_id, nombre, alias_pago').eq('user_id', host_id).execute()
        if host_profile.data:
            h = host_profile.data[0]
            miembros.insert(0, PlayerInfo(id=h['user_id'], nombre=h['nombre'], alias_pago=h.get('alias_pago'), is_guest=False))

    partidas_resp = (
        service.table('cash_session')
        .select('*')
        .eq('grupo_id', grupo_id)
        .order('fecha', desc=True)
        .execute()
    )

    members_count = len(player_ids)
    partidas_count = len(partidas_resp.data)

    grupo_info = GrupoResponse(
        id=grupo_row['id'], host_id=grupo_row['host_id'], nombre=grupo_row['nombre'],
        created_at=grupo_row['created_at'],
        total_miembros=members_count, total_partidas=partidas_count,
    )

    return GrupoDetail(
        grupo=grupo_info,
        miembros=miembros,
        partidas=[_build_session_response(r) for r in partidas_resp.data],
    )


@router.delete("/grupos/{grupo_id}", status_code=204)
def delete_grupo(grupo_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)
    try:
        sessions_resp = service.table('cash_session').select('id').eq('grupo_id', grupo_id).execute()
        session_ids = [s['id'] for s in sessions_resp.data]
        if session_ids:
            service.table('settlement').delete().in_('session_id', session_ids).execute()
            service.table('cashout').delete().in_('session_id', session_ids).execute()
            service.table('buyin').delete().in_('session_id', session_ids).execute()
            service.table('session_player').delete().in_('session_id', session_ids).execute()
            service.table('cash_session').delete().in_('id', session_ids).execute()
        service.table('grupo_member').delete().eq('grupo_id', grupo_id).execute()
        service.table('grupo').delete().eq('id', grupo_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

@router.get("/grupos/{grupo_id}/members", response_model=list[PlayerInfo])
def list_members(grupo_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    grupo = _require_grupo_host(grupo_id, user.id, service)
    members_resp = service.table('grupo_member').select('player_id').eq('grupo_id', grupo_id).execute()
    player_ids = [row['player_id'] for row in members_resp.data]
    player_map = resolve_player_map(player_ids, service)
    miembros = [
        PlayerInfo(id=pid, **player_map.get(pid, {'nombre': pid, 'alias_pago': None, 'is_guest': False}))
        for pid in player_ids
    ]
    host_id = grupo['host_id']
    if not any(m.id == host_id for m in miembros):
        host_profile = service.table('profile').select('user_id, nombre, alias_pago').eq('user_id', host_id).execute()
        if host_profile.data:
            h = host_profile.data[0]
            miembros.insert(0, PlayerInfo(id=h['user_id'], nombre=h['nombre'], alias_pago=h.get('alias_pago'), is_guest=False))
    return miembros


@router.post("/grupos/{grupo_id}/members", response_model=PlayerInfo, status_code=201)
def add_registered_member(grupo_id: str, body: dict, user=Depends(get_current_user)):
    """Add a registered user to the grupo by UUID or email. Host only."""
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)

    player_id = body.get('player_id')
    email = body.get('email')
    if not player_id and not email:
        raise HTTPException(status_code=422, detail="player_id o email requerido")

    if email and not player_id:
        profile_by_email = (
            service.table('profile')
            .select('user_id, nombre, alias_pago')
            .eq('email', email.lower().strip())
            .execute()
        )
        if not profile_by_email.data:
            raise HTTPException(status_code=404, detail="No se encontró un usuario con ese email")
        player_id = profile_by_email.data[0]['user_id']

    profile_resp = service.table('profile').select('user_id, nombre, alias_pago').eq('user_id', player_id).execute()
    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if player_id == user.id:
        raise HTTPException(status_code=400, detail="No podés agregarte a vos mismo como miembro")

    existing = service.table('grupo_member').select('player_id').eq('grupo_id', grupo_id).eq('player_id', player_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="El jugador ya está en el grupo")

    service.table('grupo_member').insert({'grupo_id': grupo_id, 'player_id': player_id}).execute()
    p = profile_resp.data[0]
    return PlayerInfo(id=p['user_id'], nombre=p['nombre'], alias_pago=p.get('alias_pago'), is_guest=False)


@router.post("/grupos/{grupo_id}/guests", response_model=PlayerInfo, status_code=201)
def add_guest_member(grupo_id: str, body: GuestPlayerCreate, user=Depends(get_current_user)):
    """Create a guest player and add them to the grupo."""
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)

    guest_resp = service.table('guest_player').insert({
        'host_id': user.id,
        'nombre': body.nombre,
        'alias_pago': body.alias_pago,
    }).execute()
    guest = guest_resp.data[0]

    service.table('grupo_member').insert({'grupo_id': grupo_id, 'player_id': guest['id']}).execute()

    return PlayerInfo(id=guest['id'], nombre=guest['nombre'], alias_pago=guest.get('alias_pago'), is_guest=True)


@router.delete("/grupos/{grupo_id}/members/{player_id}", status_code=204)
def remove_member(grupo_id: str, player_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)
    service.table('grupo_member').delete().eq('grupo_id', grupo_id).eq('player_id', player_id).execute()


@router.post("/guests/{guest_id}/link", response_model=PlayerInfo)
def link_guest_to_user(guest_id: str, body: GuestLinkRequest, user=Depends(get_current_user)):
    """
    Link a guest player to an existing registered account.
    Migrates all historical data (buyins, cashouts, settlements, grupo memberships)
    from the guest UUID to the real user UUID, then deletes the guest row.
    Host only — the guest must belong to the authenticated user.
    """
    service = get_service_client()

    guest_resp = (
        service.table('guest_player')
        .select('*')
        .eq('id', guest_id)
        .eq('host_id', user.id)
        .execute()
    )
    if not guest_resp.data:
        raise HTTPException(status_code=404, detail="Invitado no encontrado o sin permiso")

    profile_resp = (
        service.table('profile')
        .select('user_id, nombre, alias_pago')
        .eq('user_id', body.user_id)
        .execute()
    )
    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Usuario registrado no encontrado")

    new_id = body.user_id
    try:
        service.table('session_player').update({'player_id': new_id}).eq('player_id', guest_id).execute()
        service.table('buyin').update({'player_id': new_id}).eq('player_id', guest_id).execute()
        service.table('cashout').update({'player_id': new_id}).eq('player_id', guest_id).execute()
        service.table('settlement').update({'deudor_id': new_id}).eq('deudor_id', guest_id).execute()
        service.table('settlement').update({'acreedor_id': new_id}).eq('acreedor_id', guest_id).execute()

        gm_resp = service.table('grupo_member').select('grupo_id').eq('player_id', guest_id).execute()
        for gm in gm_resp.data:
            existing = (
                service.table('grupo_member')
                .select('player_id')
                .eq('grupo_id', gm['grupo_id'])
                .eq('player_id', new_id)
                .execute()
            )
            if not existing.data:
                service.table('grupo_member').insert({'grupo_id': gm['grupo_id'], 'player_id': new_id}).execute()
        service.table('grupo_member').delete().eq('player_id', guest_id).execute()

        service.table('guest_player').delete().eq('id', guest_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    p = profile_resp.data[0]
    return PlayerInfo(id=p['user_id'], nombre=p['nombre'], alias_pago=p.get('alias_pago'), is_guest=False)


# ---------------------------------------------------------------------------
# Invite links
# ---------------------------------------------------------------------------

@router.post("/grupos/{grupo_id}/invite", response_model=InviteInfo)
def create_invite(grupo_id: str, user=Depends(get_current_user)):
    """Generate (or return existing) invite token for a grupo. Host only."""
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)

    existing = service.table('grupo_invite').select('*').eq('grupo_id', grupo_id).execute()
    if existing.data:
        token = existing.data[0]['token']
    else:
        resp = service.table('grupo_invite').insert({'grupo_id': grupo_id}).execute()
        token = resp.data[0]['token']

    grupo = _get_grupo_or_404(grupo_id, service)
    return InviteInfo(token=token, grupo_id=grupo_id, grupo_nombre=grupo['nombre'])


@router.delete("/grupos/{grupo_id}/invite", status_code=204)
def revoke_invite(grupo_id: str, user=Depends(get_current_user)):
    """Revoke the invite link for a grupo. Host only."""
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)
    service.table('grupo_invite').delete().eq('grupo_id', grupo_id).execute()


@router.get("/invite/{token}", response_model=InviteInfo)
def get_invite_info(token: str):
    """Public endpoint — returns group name for the invite preview page."""
    service = get_service_client()
    resp = service.table('grupo_invite').select('token, grupo_id').eq('token', token).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Link de invitación no encontrado o expirado")
    invite = resp.data[0]
    grupo = _get_grupo_or_404(invite['grupo_id'], service)
    return InviteInfo(token=token, grupo_id=invite['grupo_id'], grupo_nombre=grupo['nombre'])


@router.post("/invite/{token}/join", response_model=PlayerInfo)
def join_via_invite(token: str, user=Depends(get_current_user)):
    """Join a grupo using an invite link. Requires authentication."""
    service = get_service_client()
    resp = service.table('grupo_invite').select('grupo_id').eq('token', token).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Link de invitación no encontrado o expirado")

    grupo_id = resp.data[0]['grupo_id']

    # Host can't join their own group as a member
    grupo = _get_grupo_or_404(grupo_id, service)
    if grupo['host_id'] == user.id:
        raise HTTPException(status_code=400, detail="Sos el host de este grupo")

    existing = (
        service.table('grupo_member')
        .select('player_id')
        .eq('grupo_id', grupo_id)
        .eq('player_id', user.id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Ya sos miembro de este grupo")

    profile_resp = service.table('profile').select('user_id, nombre, alias_pago').eq('user_id', user.id).execute()
    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    service.table('grupo_member').insert({'grupo_id': grupo_id, 'player_id': user.id}).execute()
    p = profile_resp.data[0]
    return PlayerInfo(id=p['user_id'], nombre=p['nombre'], alias_pago=p.get('alias_pago'), is_guest=False)


# ---------------------------------------------------------------------------
# Partidas (sessions within a grupo)
# ---------------------------------------------------------------------------

@router.get("/grupos/{grupo_id}/ranking")
def get_ranking(grupo_id: str, user=Depends(get_current_user)):
    """Aggregate wins/losses per player across all closed sessions in the group."""
    service = get_service_client()
    _require_grupo_access(grupo_id, user.id, service)

    sessions_resp = (
        service.table('cash_session')
        .select('id')
        .eq('grupo_id', grupo_id)
        .eq('estado', 'cerrada')
        .execute()
    )
    session_ids = [s['id'] for s in sessions_resp.data]
    if not session_ids:
        return []

    buyins_resp = service.table('buyin').select('player_id,monto,session_id').in_('session_id', session_ids).execute()
    cashouts_resp = service.table('cashout').select('player_id,monto,session_id').in_('session_id', session_ids).execute()

    # Aggregate per player totals and per-session netos
    stats: dict[str, dict] = {}
    session_buyin: dict[str, dict[str, int]] = {}   # {session_id: {player_id: monto}}
    session_cashout: dict[str, dict[str, int]] = {}

    for b in buyins_resp.data:
        pid, sid, monto = b['player_id'], b['session_id'], b['monto']
        if pid not in stats:
            stats[pid] = {'total_buyin': 0, 'total_cashout': 0, 'sesiones': set()}
        stats[pid]['total_buyin'] += monto
        stats[pid]['sesiones'].add(sid)
        session_buyin.setdefault(sid, {}).setdefault(pid, 0)
        session_buyin[sid][pid] += monto

    for c in cashouts_resp.data:
        pid, sid, monto = c['player_id'], c['session_id'], c['monto']
        if pid not in stats:
            stats[pid] = {'total_buyin': 0, 'total_cashout': 0, 'sesiones': set()}
        stats[pid]['total_cashout'] += monto
        stats[pid]['sesiones'].add(sid)
        session_cashout.setdefault(sid, {}).setdefault(pid, 0)
        session_cashout[sid][pid] += monto

    # Best single-session neto per player (None = no sessions played)
    best_session: dict[str, int | None] = {pid: None for pid in stats}
    all_pids_in_sessions = set(pid for d in session_buyin.values() for pid in d) | \
                           set(pid for d in session_cashout.values() for pid in d)
    for sid in session_ids:
        for pid in all_pids_in_sessions:
            if pid not in stats:
                continue
            neto = session_cashout.get(sid, {}).get(pid, 0) - session_buyin.get(sid, {}).get(pid, 0)
            cur = best_session.get(pid)
            if cur is None or neto > cur:
                best_session[pid] = neto

    player_map = resolve_player_map(list(stats.keys()), service)

    result = [
        {
            'player_id': pid,
            'nombre': player_map.get(pid, {}).get('nombre', pid),
            'sesiones': len(s['sesiones']),
            'total_buyin': s['total_buyin'],
            'total_cashout': s['total_cashout'],
            'neto': s['total_cashout'] - s['total_buyin'],
            'mejor_sesion': best_session.get(pid),
        }
        for pid, s in stats.items()
    ]
    result.sort(key=lambda x: x['neto'], reverse=True)
    return result


@router.post("/grupos/{grupo_id}/partidas", response_model=SessionResponse, status_code=201)
def create_partida(grupo_id: str, body: SessionCreate, user=Depends(get_current_user)):
    """Create a new partida (game night) within a grupo."""
    service = get_service_client()
    _require_grupo_host(grupo_id, user.id, service)

    today = date.today()
    nombre = body.nombre or today.strftime("%-d de %B")

    try:
        session_resp = service.table('cash_session').insert({
            'host_id': user.id,
            'grupo_id': grupo_id,
            'nombre': nombre,
            'fecha': body.fecha.isoformat() if body.fecha else today.isoformat(),
            'lugar': body.lugar,
            'estado': 'abierta',
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return _build_session_response(session_resp.data[0])


@router.get("/grupos/{grupo_id}/my-settlements")
def get_my_settlements(grupo_id: str, user=Depends(get_current_user)):
    """Settlements for the current user (as deudor or acreedor) across all closed sessions."""
    service = get_service_client()
    _require_grupo_access(grupo_id, user.id, service)
    sessions_resp = (
        service.table('cash_session')
        .select('id,nombre,fecha')
        .eq('grupo_id', grupo_id)
        .eq('estado', 'cerrada')
        .execute()
    )
    session_ids = [s['id'] for s in sessions_resp.data]
    if not session_ids:
        return []
    session_map = {s['id']: s for s in sessions_resp.data}
    deudor_resp = service.table('settlement').select('*').in_('session_id', session_ids).eq('deudor_id', user.id).execute()
    acreedor_resp = service.table('settlement').select('*').in_('session_id', session_ids).eq('acreedor_id', user.id).execute()
    all_pids: set[str] = set()
    for s in deudor_resp.data + acreedor_resp.data:
        all_pids.update([s['deudor_id'], s['acreedor_id']])
    player_map = resolve_player_map(list(all_pids), service) if all_pids else {}
    result = []
    for s in deudor_resp.data:
        result.append({**s, 'role': 'deudor',
            'other_nombre': player_map.get(s['acreedor_id'], {}).get('nombre', '?'),
            'other_alias': player_map.get(s['acreedor_id'], {}).get('alias_pago'),
            'session_nombre': session_map.get(s['session_id'], {}).get('nombre', ''),
        })
    for s in acreedor_resp.data:
        result.append({**s, 'role': 'acreedor',
            'other_nombre': player_map.get(s['deudor_id'], {}).get('nombre', '?'),
            'other_alias': player_map.get(s['deudor_id'], {}).get('alias_pago'),
            'session_nombre': session_map.get(s['session_id'], {}).get('nombre', ''),
        })
    result.sort(key=lambda x: (x['estado'] == 'pagado', x['session_nombre']))
    return result
