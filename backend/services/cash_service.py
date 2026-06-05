"""
Cash session service helpers extracted to keep routers under 500 lines.
"""
from __future__ import annotations

from datetime import date

from fastapi import HTTPException

from services.settlement import compute_settlements, get_session_summary


def close_session_logic(session_id: str, user_id: str, service) -> dict:
    """
    Validate and close a cash session.
    - Verifies the caller is the host.
    - Checks all players have a cashout.
    - Computes and persists settlements.
    - Updates estado to 'cerrada'.
    Returns the updated session row.
    """
    session_resp = (
        service.table('cash_session')
        .select('*')
        .eq('id', session_id)
        .single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    session = session_resp.data
    if session['host_id'] != user_id:
        raise HTTPException(status_code=403, detail="Solo el host puede cerrar la sesión")
    if session['estado'] != 'abierta':
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    # Fetch all players in session
    players_resp = (
        service.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .execute()
    )
    player_ids = {row['player_id'] for row in players_resp.data}

    # Fetch all cashouts
    cashouts_resp = (
        service.table('cashout')
        .select('player_id')
        .eq('session_id', session_id)
        .execute()
    )
    cashout_player_ids = {row['player_id'] for row in cashouts_resp.data}

    missing = player_ids - cashout_player_ids
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Los siguientes jugadores no tienen cashout: {', '.join(missing)}",
        )

    try:
        compute_settlements(session_id, service)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al calcular settlements: {exc}")

    try:
        update_resp = (
            service.table('cash_session')
            .update({'estado': 'cerrada'})
            .eq('id', session_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return update_resp.data[0]


def build_session_response(row: dict) -> dict:
    """Convert a raw DB row to the fields expected by SessionResponse."""
    fecha = row.get('fecha')
    if isinstance(fecha, str):
        fecha = date.fromisoformat(fecha)
    return {
        'id': row['id'],
        'host_id': row['host_id'],
        'nombre': row['nombre'],
        'fecha': fecha or date.today(),
        'lugar': row.get('lugar'),
        'estado': row['estado'],
        'created_at': row['created_at'],
    }
