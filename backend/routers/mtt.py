"""
MTT (Multi-Table Tournament) routes: tournaments, blind levels, prizes, clock.
"""
from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_current_user, get_service_client
from models.schemas import (
    BlindLevelCreate,
    BlindLevelResponse,
    ClockState,
    ClockUpdate,
    EntryRequest,
    PrizeCreate,
    PrizeResponse,
    TournamentCreate,
    TournamentDetail,
    TournamentResponse,
)
from services.clock import get_clock_state, update_clock

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def require_tournament_host(tournament_id: str, user_id: str, db_client) -> dict:
    """
    Fetch the tournament and verify the caller is the host.
    Returns the tournament row on success; raises 403/404 otherwise.
    """
    resp = (
        db_client.table('tournament')
        .select('*')
        .eq('id', tournament_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    if resp.data['host_id'] != user_id:
        raise HTTPException(status_code=403, detail="Solo el host puede realizar esta acción")
    return resp.data


def _build_tournament_response(row: dict) -> TournamentResponse:
    fecha = row.get('fecha')
    if isinstance(fecha, str):
        fecha = date.fromisoformat(fecha)
    total_entradas = row.get('total_entradas', 0)
    buyin = row.get('buyin_centavos', 0)
    return TournamentResponse(
        id=row['id'],
        host_id=row['host_id'],
        nombre=row['nombre'],
        fecha=fecha or date.today(),
        buyin_centavos=buyin,
        stack_inicial=row['stack_inicial'],
        permite_reentry=row.get('permite_reentry', False),
        estado=row.get('estado', 'pendiente'),
        total_entradas=total_entradas,
        jugadores_activos=row.get('jugadores_activos', 0),
        pozo_calculado=total_entradas * buyin,
    )


def _build_prize_response(row: dict, pozo: int) -> PrizeResponse:
    porcentaje = row['porcentaje']
    return PrizeResponse(
        id=row['id'],
        tournament_id=row['tournament_id'],
        puesto=row['puesto'],
        porcentaje=porcentaje,
        monto_calculado=porcentaje * pozo // 10000,
    )


# ---------------------------------------------------------------------------
# Tournament CRUD
# ---------------------------------------------------------------------------

@router.post("/tournaments", response_model=TournamentResponse, status_code=201)
def create_tournament(body: TournamentCreate, user=Depends(get_current_user)):
    """Create a new tournament. A tournament_clock row is created by a DB trigger."""
    service = get_service_client()

    tournament_data = {
        'host_id': user.id,
        'nombre': body.nombre,
        'fecha': body.fecha.isoformat() if body.fecha else date.today().isoformat(),
        'buyin_centavos': body.buyin_centavos,
        'stack_inicial': body.stack_inicial,
        'permite_reentry': body.permite_reentry,
        'estado': 'pendiente',
        'total_entradas': 0,
        'jugadores_activos': 0,
    }

    try:
        resp = service.table('tournament').insert(tournament_data).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    tournament = resp.data[0]

    # Defensively create clock if the DB trigger hasn't done so yet
    try:
        service.table('tournament_clock').upsert({
            'tournament_id': tournament['id'],
            'nivel_actual': 0,
            'segundos_restantes': 0,
            'corriendo': False,
        }).execute()
    except Exception:
        pass  # Trigger may have already created it

    return _build_tournament_response(tournament)


@router.get("/tournaments", response_model=list[TournamentResponse])
def list_tournaments(user=Depends(get_current_user)):
    """Return all tournaments visible to the user."""
    service = get_service_client()

    resp = service.table('tournament').select('*').execute()
    return [_build_tournament_response(row) for row in resp.data]


@router.get("/tournaments/{tournament_id}", response_model=TournamentDetail)
def get_tournament(tournament_id: str, user=Depends(get_current_user)):
    """Return full tournament detail including blind levels, prizes, and clock."""
    service = get_service_client()

    t_resp = (
        service.table('tournament')
        .select('*')
        .eq('id', tournament_id)
        .single()
        .execute()
    )
    if not t_resp.data:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")

    tournament = _build_tournament_response(t_resp.data)
    pozo = tournament.pozo_calculado

    # Blind levels
    bl_resp = (
        service.table('blind_level')
        .select('*')
        .eq('tournament_id', tournament_id)
        .order('orden')
        .execute()
    )
    blind_levels = [BlindLevelResponse(**row) for row in bl_resp.data]

    # Prizes
    pr_resp = (
        service.table('prize')
        .select('*')
        .eq('tournament_id', tournament_id)
        .order('puesto')
        .execute()
    )
    prizes = [_build_prize_response(row, pozo) for row in pr_resp.data]

    # Clock
    clock_data = get_clock_state(tournament_id, service)
    clock = None
    if clock_data:
        nivel_info_data = clock_data.pop('nivel_info', None)
        nivel_info = BlindLevelResponse(**nivel_info_data) if nivel_info_data else None
        clock = ClockState(**clock_data, nivel_info=nivel_info)

    return TournamentDetail(
        tournament=tournament,
        blind_levels=blind_levels,
        prizes=prizes,
        clock=clock,
    )


@router.put("/tournaments/{tournament_id}", response_model=TournamentResponse)
def update_tournament(
    tournament_id: str,
    body: TournamentCreate,
    user=Depends(get_current_user),
):
    """Update tournament fields. Host only."""
    service = get_service_client()
    require_tournament_host(tournament_id, user.id, service)

    updates = body.model_dump(exclude_none=True)
    if 'fecha' in updates and isinstance(updates['fecha'], date):
        updates['fecha'] = updates['fecha'].isoformat()

    try:
        resp = (
            service.table('tournament')
            .update(updates)
            .eq('id', tournament_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return _build_tournament_response(resp.data[0])


# ---------------------------------------------------------------------------
# Blind levels (bulk replace)
# ---------------------------------------------------------------------------

@router.post("/tournaments/{tournament_id}/blind_levels", response_model=list[BlindLevelResponse], status_code=201)
def set_blind_levels(
    tournament_id: str,
    body: List[BlindLevelCreate],
    user=Depends(get_current_user),
):
    """Replace all blind levels for a tournament. Host only. Validates no duplicate orden."""
    service = get_service_client()
    require_tournament_host(tournament_id, user.id, service)

    if not body:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un nivel")

    ordenes = [level.orden for level in body]
    if len(ordenes) != len(set(ordenes)):
        raise HTTPException(status_code=400, detail="Los niveles tienen órdenes duplicados")

    # Delete existing levels
    try:
        service.table('blind_level').delete().eq('tournament_id', tournament_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al eliminar niveles existentes: {exc}")

    rows_to_insert = [
        {
            'tournament_id': tournament_id,
            'orden': level.orden,
            'sb': level.sb,
            'bb': level.bb,
            'ante': level.ante,
            'duracion_seg': level.duracion_seg,
            'es_break': level.es_break,
        }
        for level in body
    ]

    try:
        resp = service.table('blind_level').insert(rows_to_insert).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return [BlindLevelResponse(**row) for row in resp.data]


# ---------------------------------------------------------------------------
# Prizes (bulk replace)
# ---------------------------------------------------------------------------

@router.post("/tournaments/{tournament_id}/prizes", response_model=list[PrizeResponse], status_code=201)
def set_prizes(
    tournament_id: str,
    body: List[PrizeCreate],
    user=Depends(get_current_user),
):
    """Replace all prizes for a tournament. Host only. Sum of porcentajes must not exceed 10000."""
    service = get_service_client()
    tournament = require_tournament_host(tournament_id, user.id, service)

    if not body:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un premio")

    total_pct = sum(p.porcentaje for p in body)
    if total_pct > 10000:
        raise HTTPException(
            status_code=400,
            detail=f"La suma de porcentajes ({total_pct}) supera el 100% (10000)",
        )

    # Delete existing prizes before inserting (validated first to avoid partial state)
    try:
        service.table('prize').delete().eq('tournament_id', tournament_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al eliminar premios existentes: {exc}")

    rows_to_insert = [
        {
            'tournament_id': tournament_id,
            'puesto': prize.puesto,
            'porcentaje': prize.porcentaje,
        }
        for prize in body
    ]

    try:
        resp = service.table('prize').insert(rows_to_insert).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    pozo = tournament.get('total_entradas', 0) * tournament.get('buyin_centavos', 0)
    return [_build_prize_response(row, pozo) for row in resp.data]


# ---------------------------------------------------------------------------
# Tournament lifecycle
# ---------------------------------------------------------------------------

@router.post("/tournaments/{tournament_id}/start", response_model=TournamentResponse)
def start_tournament(tournament_id: str, user=Depends(get_current_user)):
    """
    Start the tournament. Sets estado='en_curso'.
    Initialises the clock at level 0 (or level 1 if nivel 0 doesn't exist)
    with the duration of the first blind level.
    Host only.
    """
    service = get_service_client()
    tournament = require_tournament_host(tournament_id, user.id, service)

    if tournament['estado'] != 'pendiente':
        raise HTTPException(status_code=400, detail="El torneo no está en estado pendiente")

    # Get the first blind level to set the initial clock duration
    first_level_resp = (
        service.table('blind_level')
        .select('*')
        .eq('tournament_id', tournament_id)
        .order('orden')
        .limit(1)
        .execute()
    )

    if not first_level_resp.data:
        raise HTTPException(status_code=400, detail="El torneo no tiene niveles de ciegas configurados")

    first_level = first_level_resp.data[0]
    first_orden = first_level['orden']
    first_duration = first_level['duracion_seg']

    # Update tournament status
    try:
        t_resp = (
            service.table('tournament')
            .update({'estado': 'en_curso'})
            .eq('id', tournament_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Update clock to first level
    try:
        update_clock(
            tournament_id,
            {
                'nivel_actual': first_orden,
                'segundos_restantes': first_duration,
                'corriendo': False,
            },
            service,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Torneo iniciado pero error al actualizar reloj: {exc}")

    return _build_tournament_response(t_resp.data[0])


@router.post("/tournaments/{tournament_id}/entries", response_model=TournamentResponse)
def add_entry(
    tournament_id: str,
    body: EntryRequest,
    user=Depends(get_current_user),
):
    """
    Register an entry or re-entry. Host only.
    Always increments total_entradas.
    If reentry=False, also increments jugadores_activos.
    """
    service = get_service_client()
    tournament = require_tournament_host(tournament_id, user.id, service)

    updates: dict = {'total_entradas': tournament['total_entradas'] + 1}

    if not body.reentry:
        updates['jugadores_activos'] = tournament['jugadores_activos'] + 1

    try:
        resp = (
            service.table('tournament')
            .update(updates)
            .eq('id', tournament_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return _build_tournament_response(resp.data[0])


@router.post("/tournaments/{tournament_id}/eliminate", response_model=TournamentResponse)
def eliminate_player(tournament_id: str, user=Depends(get_current_user)):
    """
    Record a player elimination. Decrements jugadores_activos (floor 0). Host only.
    """
    service = get_service_client()
    tournament = require_tournament_host(tournament_id, user.id, service)

    current_active = tournament.get('jugadores_activos', 0)
    new_active = max(0, current_active - 1)

    try:
        resp = (
            service.table('tournament')
            .update({'jugadores_activos': new_active})
            .eq('id', tournament_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return _build_tournament_response(resp.data[0])


# ---------------------------------------------------------------------------
# Clock
# ---------------------------------------------------------------------------

@router.put("/tournaments/{tournament_id}/clock", response_model=ClockState)
def set_clock(
    tournament_id: str,
    body: ClockUpdate,
    user=Depends(get_current_user),
):
    """Update the tournament clock. Host only. Triggers Supabase Realtime."""
    service = get_service_client()
    require_tournament_host(tournament_id, user.id, service)

    clock_data = body.model_dump()

    try:
        update_clock(tournament_id, clock_data, service)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    updated = get_clock_state(tournament_id, service)
    if not updated:
        raise HTTPException(status_code=500, detail="Error al leer el reloj actualizado")

    nivel_info_data = updated.pop('nivel_info', None)
    nivel_info = BlindLevelResponse(**nivel_info_data) if nivel_info_data else None
    return ClockState(**updated, nivel_info=nivel_info)


@router.get("/tournaments/{tournament_id}/clock", response_model=ClockState)
def get_clock(tournament_id: str, user=Depends(get_current_user)):
    """Return the current clock state for a tournament."""
    service = get_service_client()

    t_resp = (
        service.table('tournament')
        .select('id')
        .eq('id', tournament_id)
        .single()
        .execute()
    )
    if not t_resp.data:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")

    clock_data = get_clock_state(tournament_id, service)
    if not clock_data:
        raise HTTPException(status_code=404, detail="Reloj no encontrado para este torneo")

    nivel_info_data = clock_data.pop('nivel_info', None)
    nivel_info = BlindLevelResponse(**nivel_info_data) if nivel_info_data else None
    return ClockState(**clock_data, nivel_info=nivel_info)
