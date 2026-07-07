"""
Personal tracker service helpers: net-result calculation, session CRUD with the
cash/tournament split, and bankroll balance computation. Extracted to keep the
router under 500 lines (same pattern as cash_service.py).
"""
from __future__ import annotations

from datetime import date
from typing import Optional, Tuple

from fastapi import HTTPException

from models.tracker_schemas import PokerSessionCreate, TournamentEntryData


def _torneo_costo_total(t: TournamentEntryData) -> int:
    """Rebuys and add-ons are assumed to cost the buy-in amount (the common case)."""
    return t.buyin_centavos + t.comision_centavos + (t.rebuys + t.addons) * t.buyin_centavos


def compute_resultado_neto(body: PokerSessionCreate) -> Tuple[int, Optional[int]]:
    """
    Returns (resultado_neto_centavos, costo_total_centavos).
    costo_total is None for cash sessions — only tournaments track a "cost".
    """
    if body.tipo == 'cash':
        return body.cashout_centavos - body.buyin_total_centavos, None

    t = body.torneo
    costo_total = _torneo_costo_total(t)
    neto = (t.premio_pozo_centavos + t.ganancia_bounty_centavos) - costo_total
    return neto, costo_total


def build_session_row(body: PokerSessionCreate, user_id: str) -> dict:
    neto, _ = compute_resultado_neto(body)
    row = {
        'user_id': user_id,
        'bankroll_id': body.bankroll_id,
        'tipo': body.tipo,
        'modalidad': body.modalidad,
        'variante': body.variante,
        'fecha': (body.fecha or date.today()).isoformat(),
        'ubicacion': body.ubicacion,
        'duracion_min': body.duracion_min,
        'notas': body.notas,
        'mood': body.mood,
        'resultado_neto_centavos': neto,
        'stakes_sb_centavos': None,
        'stakes_bb_centavos': None,
        'buyin_total_centavos': None,
        'cashout_centavos': None,
        'mesa_size': None,
    }
    if body.tipo == 'cash':
        row.update({
            'stakes_sb_centavos': body.stakes_sb_centavos,
            'stakes_bb_centavos': body.stakes_bb_centavos,
            'buyin_total_centavos': body.buyin_total_centavos,
            'cashout_centavos': body.cashout_centavos,
            'mesa_size': body.mesa_size,
        })
    return row


def build_tournament_entry_row(session_id: str, body: PokerSessionCreate) -> dict:
    t = body.torneo
    _, costo_total = compute_resultado_neto(body)
    return {
        'session_id': session_id,
        'nombre_torneo': t.nombre_torneo,
        'buyin_centavos': t.buyin_centavos,
        'comision_centavos': t.comision_centavos,
        'rebuys': t.rebuys,
        'addons': t.addons,
        'costo_total_centavos': costo_total,
        'es_bounty': t.es_bounty,
        'tipo_bounty': t.tipo_bounty,
        'bounties_cobrados': t.bounties_cobrados,
        'ganancia_bounty_centavos': t.ganancia_bounty_centavos,
        'premio_pozo_centavos': t.premio_pozo_centavos,
        'entrantes_totales': t.entrantes_totales,
        'posicion_final': t.posicion_final,
        'puestos_pagos': t.puestos_pagos,
        'estructura': t.estructura,
        'late_reg': t.late_reg,
    }


def create_session(body: PokerSessionCreate, user_id: str, service) -> dict:
    """
    Insert poker_session and, for tournaments, its tournament_entry detail.
    Supabase's REST layer has no cross-table transactions, so on a failed
    detail insert we manually delete the just-created session row.
    """
    session_row = build_session_row(body, user_id)
    try:
        resp = service.table('poker_session').insert(session_row).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    session = resp.data[0]

    if body.tipo == 'torneo':
        entry_row = build_tournament_entry_row(session['id'], body)
        try:
            entry_resp = service.table('tournament_entry').insert(entry_row).execute()
        except Exception as exc:
            service.table('poker_session').delete().eq('id', session['id']).execute()
            raise HTTPException(status_code=500, detail=str(exc))
        session['torneo'] = entry_resp.data[0]
    else:
        session['torneo'] = None

    return session


def _require_session_owner(session_id: str, user_id: str, service) -> dict:
    resp = service.table('poker_session').select('*').eq('id', session_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if resp.data['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    return resp.data


def update_session(session_id: str, body: PokerSessionCreate, user_id: str, service) -> dict:
    """Update a session, replacing its tournament_entry detail (1:1, drop + re-insert)."""
    _require_session_owner(session_id, user_id, service)

    session_row = build_session_row(body, user_id)
    try:
        resp = service.table('poker_session').update(session_row).eq('id', session_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    session = resp.data[0]

    # Drop any previous detail row first — covers edits that switch cash <-> torneo.
    service.table('tournament_entry').delete().eq('session_id', session_id).execute()
    if body.tipo == 'torneo':
        entry_row = build_tournament_entry_row(session_id, body)
        try:
            entry_resp = service.table('tournament_entry').insert(entry_row).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        session['torneo'] = entry_resp.data[0]
    else:
        session['torneo'] = None

    return session


def delete_session(session_id: str, user_id: str, service) -> None:
    _require_session_owner(session_id, user_id, service)
    service.table('poker_session').delete().eq('id', session_id).execute()


def fetch_session_detail(session_id: str, user_id: str, service) -> dict:
    session = _require_session_owner(session_id, user_id, service)
    if session['tipo'] == 'torneo':
        entry_resp = (
            service.table('tournament_entry')
            .select('*')
            .eq('session_id', session_id)
            .maybe_single()
            .execute()
        )
        session['torneo'] = entry_resp.data if entry_resp else None
    else:
        session['torneo'] = None
    return session


def attach_torneo_detail(sessions: list[dict], service) -> list[dict]:
    """Batch-fetch tournament_entry rows for a list of sessions (avoids N+1 queries)."""
    torneo_ids = [s['id'] for s in sessions if s['tipo'] == 'torneo']
    entries_by_session: dict[str, dict] = {}
    if torneo_ids:
        entries_resp = (
            service.table('tournament_entry').select('*').in_('session_id', torneo_ids).execute()
        )
        entries_by_session = {row['session_id']: row for row in entries_resp.data}
    for s in sessions:
        s['torneo'] = entries_by_session.get(s['id'])
    return sessions


# ---------------------------------------------------------------------------
# Bankroll
# ---------------------------------------------------------------------------

def require_bankroll_owner(bankroll_id: str, user_id: str, service) -> dict:
    resp = service.table('bankroll').select('*').eq('id', bankroll_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Bankroll no encontrado")
    if resp.data['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    return resp.data


def compute_bankroll_balance(bankroll: dict, service) -> int:
    """saldo_actual = saldo_inicial + Σ resultado_neto (sesiones) + Σ movimientos manuales (con signo)."""
    bankroll_id = bankroll['id']
    saldo = bankroll['saldo_inicial_centavos']

    sessions_resp = (
        service.table('poker_session')
        .select('resultado_neto_centavos')
        .eq('bankroll_id', bankroll_id)
        .execute()
    )
    saldo += sum(row['resultado_neto_centavos'] for row in sessions_resp.data)

    tx_resp = (
        service.table('bankroll_transaction')
        .select('tipo, monto_centavos')
        .eq('bankroll_id', bankroll_id)
        .execute()
    )
    for row in tx_resp.data:
        if row['tipo'] in ('deposito', 'transferencia_entrada'):
            saldo += row['monto_centavos']
        else:
            saldo -= row['monto_centavos']

    return saldo


# ---------------------------------------------------------------------------
# Goals — monthly profit / hours targets
# ---------------------------------------------------------------------------

def _periodo_bounds(periodo: str) -> Tuple[str, str]:
    """'2026-06' -> ('2026-06-01', '2026-07-01'), used as a half-open [desde, hasta) range."""
    year, month = (int(p) for p in periodo.split('-'))
    desde = date(year, month, 1)
    hasta = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return desde.isoformat(), hasta.isoformat()


def compute_goal_progress(periodo: str, user_id: str, service) -> Tuple[int, float]:
    """Suma resultado_neto y horas jugadas de las sesiones del usuario dentro del período."""
    desde, hasta = _periodo_bounds(periodo)
    resp = (
        service.table('poker_session')
        .select('resultado_neto_centavos, duracion_min')
        .eq('user_id', user_id)
        .gte('fecha', desde)
        .lt('fecha', hasta)
        .execute()
    )
    neto = sum(row['resultado_neto_centavos'] for row in resp.data)
    minutos = sum(row.get('duracion_min') or 0 for row in resp.data)
    return neto, round(minutos / 60, 1)


def upsert_goal(periodo: str, objetivo_ganancia_centavos, objetivo_horas, user_id: str, service) -> dict:
    data = {
        'user_id': user_id,
        'periodo': periodo,
        'objetivo_ganancia_centavos': objetivo_ganancia_centavos,
        'objetivo_horas': objetivo_horas,
    }
    try:
        resp = service.table('tracker_goal').upsert(data, on_conflict='user_id,periodo').execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return resp.data[0]
