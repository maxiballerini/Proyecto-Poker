"""
Personal poker tracker routes: sessions (cash + tournament), bankrolls, and
manual bankroll movements. Everything here is single-user/private — RLS and
the route handlers both gate on `user_id = auth.uid()`.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_current_user, get_service_client
from models.tracker_schemas import (
    BankrollCreate,
    BankrollResponse,
    BankrollTransactionCreate,
    BankrollTransactionResponse,
    BankrollUpdate,
    GoalResponse,
    GoalUpsert,
    PokerSessionCreate,
    PokerSessionResponse,
    TrackerStatsResponse,
)
from services.tracker_service import (
    attach_torneo_detail,
    compute_bankroll_balance,
    compute_goal_progress,
    create_session,
    delete_session,
    fetch_session_detail,
    require_bankroll_owner,
    update_session,
    upsert_goal,
)
from services.tracker_stats_service import compute_stats

router = APIRouter()


def _fetch_sessions_with_torneo(
    user_id: str,
    service,
    *,
    tipo: Optional[str] = None,
    modalidad: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
) -> list[dict]:
    query = service.table('poker_session').select('*').eq('user_id', user_id)
    if tipo:
        query = query.eq('tipo', tipo)
    if modalidad:
        query = query.eq('modalidad', modalidad)
    if desde:
        query = query.gte('fecha', desde.isoformat())
    if hasta:
        query = query.lte('fecha', hasta.isoformat())
    resp = query.execute()
    return attach_torneo_detail(resp.data, service)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@router.post("/sessions", response_model=PokerSessionResponse, status_code=201)
def create_poker_session(body: PokerSessionCreate, user=Depends(get_current_user)):
    service = get_service_client()
    return create_session(body, user.id, service)


@router.get("/sessions", response_model=list[PokerSessionResponse])
def list_poker_sessions(
    tipo: Optional[str] = None,
    modalidad: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    bankroll_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    """List the caller's sessions, optionally filtered. Newest first."""
    service = get_service_client()
    query = service.table('poker_session').select('*').eq('user_id', user.id)
    if tipo:
        query = query.eq('tipo', tipo)
    if modalidad:
        query = query.eq('modalidad', modalidad)
    if bankroll_id:
        query = query.eq('bankroll_id', bankroll_id)
    if desde:
        query = query.gte('fecha', desde.isoformat())
    if hasta:
        query = query.lte('fecha', hasta.isoformat())

    resp = query.order('fecha', desc=True).order('created_at', desc=True).execute()
    return attach_torneo_detail(resp.data, service)


@router.get("/stats", response_model=TrackerStatsResponse)
def get_tracker_stats(
    tipo: Optional[str] = None,
    modalidad: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    user=Depends(get_current_user),
):
    """Dashboard de estadísticas: generales, breakdowns por categoría, torneos, bounty y cash."""
    service = get_service_client()
    sessions = _fetch_sessions_with_torneo(user.id, service, tipo=tipo, modalidad=modalidad, desde=desde, hasta=hasta)
    return compute_stats(sessions)


@router.get("/sessions/{session_id}", response_model=PokerSessionResponse)
def get_poker_session(session_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    return fetch_session_detail(session_id, user.id, service)


@router.put("/sessions/{session_id}", response_model=PokerSessionResponse)
def update_poker_session(session_id: str, body: PokerSessionCreate, user=Depends(get_current_user)):
    service = get_service_client()
    return update_session(session_id, body, user.id, service)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_poker_session(session_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    delete_session(session_id, user.id, service)


# ---------------------------------------------------------------------------
# Bankrolls
# ---------------------------------------------------------------------------

def _build_bankroll_response(row: dict, service) -> BankrollResponse:
    return BankrollResponse(
        id=row['id'],
        user_id=row['user_id'],
        nombre=row['nombre'],
        moneda=row['moneda'],
        saldo_inicial_centavos=row['saldo_inicial_centavos'],
        saldo_actual_centavos=compute_bankroll_balance(row, service),
        created_at=row['created_at'],
    )


@router.post("/bankrolls", response_model=BankrollResponse, status_code=201)
def create_bankroll(body: BankrollCreate, user=Depends(get_current_user)):
    service = get_service_client()
    data = {
        'user_id': user.id,
        'nombre': body.nombre,
        'moneda': body.moneda,
        'saldo_inicial_centavos': body.saldo_inicial_centavos,
    }
    try:
        resp = service.table('bankroll').insert(data).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return _build_bankroll_response(resp.data[0], service)


@router.get("/bankrolls", response_model=list[BankrollResponse])
def list_bankrolls(user=Depends(get_current_user)):
    service = get_service_client()
    resp = service.table('bankroll').select('*').eq('user_id', user.id).order('created_at').execute()
    return [_build_bankroll_response(row, service) for row in resp.data]


@router.put("/bankrolls/{bankroll_id}", response_model=BankrollResponse)
def update_bankroll(bankroll_id: str, body: BankrollUpdate, user=Depends(get_current_user)):
    service = get_service_client()
    require_bankroll_owner(bankroll_id, user.id, service)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        resp = service.table('bankroll').update(data).eq('id', bankroll_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return _build_bankroll_response(resp.data[0], service)


@router.delete("/bankrolls/{bankroll_id}", status_code=204)
def delete_bankroll(bankroll_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    require_bankroll_owner(bankroll_id, user.id, service)
    service.table('bankroll').delete().eq('id', bankroll_id).execute()


# ---------------------------------------------------------------------------
# Bankroll movements (manual deposits / withdrawals / transfers)
# ---------------------------------------------------------------------------

@router.post(
    "/bankrolls/{bankroll_id}/transactions",
    response_model=BankrollTransactionResponse,
    status_code=201,
)
def create_bankroll_transaction(
    bankroll_id: str, body: BankrollTransactionCreate, user=Depends(get_current_user)
):
    service = get_service_client()
    require_bankroll_owner(bankroll_id, user.id, service)
    data = {
        'bankroll_id': bankroll_id,
        'tipo': body.tipo,
        'monto_centavos': body.monto_centavos,
        'nota': body.nota,
        'fecha': (body.fecha or date.today()).isoformat(),
    }
    try:
        resp = service.table('bankroll_transaction').insert(data).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return resp.data[0]


@router.get(
    "/bankrolls/{bankroll_id}/transactions",
    response_model=list[BankrollTransactionResponse],
)
def list_bankroll_transactions(bankroll_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    require_bankroll_owner(bankroll_id, user.id, service)
    resp = (
        service.table('bankroll_transaction')
        .select('*')
        .eq('bankroll_id', bankroll_id)
        .order('fecha', desc=True)
        .order('created_at', desc=True)
        .execute()
    )
    return resp.data


@router.delete(
    "/bankrolls/{bankroll_id}/transactions/{transaction_id}",
    status_code=204,
)
def delete_bankroll_transaction(bankroll_id: str, transaction_id: str, user=Depends(get_current_user)):
    service = get_service_client()
    require_bankroll_owner(bankroll_id, user.id, service)
    service.table('bankroll_transaction').delete().eq('id', transaction_id).eq('bankroll_id', bankroll_id).execute()


# ---------------------------------------------------------------------------
# Goals (monthly profit / hours targets)
# ---------------------------------------------------------------------------

def _build_goal_response(row: dict, user_id: str, service) -> GoalResponse:
    progreso_ganancia, progreso_horas = compute_goal_progress(row['periodo'], user_id, service)
    return GoalResponse(
        id=row['id'],
        user_id=row['user_id'],
        periodo=row['periodo'],
        objetivo_ganancia_centavos=row.get('objetivo_ganancia_centavos'),
        objetivo_horas=row.get('objetivo_horas'),
        progreso_ganancia_centavos=progreso_ganancia,
        progreso_horas=progreso_horas,
        created_at=row['created_at'],
    )


@router.put("/goals/{periodo}", response_model=GoalResponse)
def set_goal(periodo: str, body: GoalUpsert, user=Depends(get_current_user)):
    if periodo != body.periodo:
        raise HTTPException(status_code=400, detail="El período de la URL no coincide con el del body")
    service = get_service_client()
    row = upsert_goal(periodo, body.objetivo_ganancia_centavos, body.objetivo_horas, user.id, service)
    return _build_goal_response(row, user.id, service)


@router.get("/goals/{periodo}", response_model=Optional[GoalResponse])
def get_goal(periodo: str, user=Depends(get_current_user)):
    service = get_service_client()
    resp = (
        service.table('tracker_goal')
        .select('*')
        .eq('user_id', user.id)
        .eq('periodo', periodo)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        return None
    return _build_goal_response(resp.data, user.id, service)
