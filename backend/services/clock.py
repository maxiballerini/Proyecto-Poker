"""
Clock service for MTT tournament clock management.
"""
from __future__ import annotations


def get_clock_state(tournament_id: str, db_client) -> dict | None:
    """
    Fetch the current clock state for a tournament, enriched with
    the blind level info for the current level.

    Returns None if no clock row exists for the tournament.
    """
    clock_resp = (
        db_client.table('tournament_clock')
        .select('*')
        .eq('tournament_id', tournament_id)
        .single()
        .execute()
    )

    if not clock_resp.data:
        return None

    clock_data = clock_resp.data
    nivel = clock_data['nivel_actual']

    blind_resp = (
        db_client.table('blind_level')
        .select('*')
        .eq('tournament_id', tournament_id)
        .eq('orden', nivel)
        .execute()
    )

    nivel_info = blind_resp.data[0] if blind_resp.data else None

    return {**clock_data, 'nivel_info': nivel_info}


def update_clock(tournament_id: str, update_data: dict, db_client) -> None:
    """
    Update the clock state for a tournament.
    Sets updated_at to the database's current timestamp via now().
    Triggers Supabase Realtime for subscribed clients.
    """
    db_client.table('tournament_clock').update(
        {**update_data, 'updated_at': 'now()'}
    ).eq('tournament_id', tournament_id).execute()
