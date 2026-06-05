"""
Settlement service for cash session debt simplification.

Uses a greedy Splitwise-style algorithm to minimize the number of transfers.
The pure `compute_settlements_from_netos` function is separated from DB logic
so it can be tested independently.
"""
from __future__ import annotations


def compute_settlements_from_netos(netos: dict[str, int]) -> list[dict]:
    """
    Pure function: given a dict of {player_id: neto_centavos}, compute the
    minimum set of transfers to settle all debts.

    neto > 0 means the player is owed money (creditor).
    neto < 0 means the player owes money (debtor).

    Returns a list of dicts with keys: deudor_id, acreedor_id, monto.
    Does NOT include session_id or estado — those are added by the caller.
    """
    # Build mutable lists sorted by magnitude descending
    debtors: list[list] = sorted(
        [[pid, -neto] for pid, neto in netos.items() if neto < 0],
        key=lambda x: -x[1],
    )
    creditors: list[list] = sorted(
        [[pid, neto] for pid, neto in netos.items() if neto > 0],
        key=lambda x: -x[1],
    )

    settlements: list[dict] = []
    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):
        debtor_id, debt = debtors[i]
        creditor_id, credit = creditors[j]

        amount = min(debt, credit)
        if amount > 0:
            settlements.append({
                'deudor_id': debtor_id,
                'acreedor_id': creditor_id,
                'monto': amount,
            })

        debtors[i][1] = debt - amount
        creditors[j][1] = credit - amount

        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1

    return settlements


def resolve_player_map(player_ids: list[str], db_client) -> dict[str, dict]:
    """
    Return {id: {nombre, alias_pago, is_guest}} for a list of player IDs.
    Checks profile (real users) first, then guest_player for any unresolved IDs.
    """
    result: dict[str, dict] = {}
    if not player_ids:
        return result

    profiles_resp = (
        db_client.table('profile')
        .select('user_id, nombre, alias_pago')
        .in_('user_id', player_ids)
        .execute()
    )
    for row in profiles_resp.data:
        result[row['user_id']] = {
            'nombre': row['nombre'],
            'alias_pago': row.get('alias_pago'),
            'is_guest': False,
        }

    remaining = [pid for pid in player_ids if pid not in result]
    if remaining:
        guests_resp = (
            db_client.table('guest_player')
            .select('id, nombre, alias_pago')
            .in_('id', remaining)
            .execute()
        )
        for row in guests_resp.data:
            result[row['id']] = {
                'nombre': row['nombre'],
                'alias_pago': row.get('alias_pago'),
                'is_guest': True,
            }

    return result


def compute_settlements(session_id: str, db_client) -> list[dict]:
    """
    Fetch buy-ins and cash-outs from the DB for the given session, run the
    greedy debt-simplification algorithm, persist the resulting settlement rows,
    and return them.
    """
    # Fetch all buy-ins for the session
    buyins_resp = (
        db_client.table('buyin')
        .select('player_id, monto')
        .eq('session_id', session_id)
        .execute()
    )

    # Sum buy-ins per player
    total_buyins: dict[str, int] = {}
    for row in buyins_resp.data:
        pid = row['player_id']
        total_buyins[pid] = total_buyins.get(pid, 0) + row['monto']

    # Fetch all cash-outs for the session
    cashouts_resp = (
        db_client.table('cashout')
        .select('player_id, monto')
        .eq('session_id', session_id)
        .execute()
    )
    cashout_map: dict[str, int] = {
        row['player_id']: row['monto'] for row in cashouts_resp.data
    }

    # Compute net position for every player that participated in any way
    all_players = set(total_buyins.keys()) | set(cashout_map.keys())
    netos: dict[str, int] = {}
    for pid in all_players:
        buyin_total = total_buyins.get(pid, 0)
        cashout = cashout_map.get(pid, 0)
        netos[pid] = cashout - buyin_total

    # Compute minimal transfers
    raw_settlements = compute_settlements_from_netos(netos)

    # Enrich with session_id and initial estado
    settlements_to_insert = [
        {
            'session_id': session_id,
            'deudor_id': s['deudor_id'],
            'acreedor_id': s['acreedor_id'],
            'monto': s['monto'],
            'estado': 'pendiente',
        }
        for s in raw_settlements
    ]

    if settlements_to_insert:
        db_client.table('settlement').insert(settlements_to_insert).execute()

    return settlements_to_insert


def get_session_summary(session_id: str, db_client) -> dict:
    """
    Build the full session summary: session info, per-player balances,
    and settlements enriched with profile names and payment aliases.
    """
    # --- Session ---
    session_resp = (
        db_client.table('cash_session')
        .select('*')
        .eq('id', session_id)
        .single()
        .execute()
    )
    session = session_resp.data

    # --- Players in session ---
    players_resp = (
        db_client.table('session_player')
        .select('player_id')
        .eq('session_id', session_id)
        .execute()
    )
    player_ids = [row['player_id'] for row in players_resp.data]

    # --- Resolve player info (real users + guests) ---
    profiles: dict[str, dict] = resolve_player_map(player_ids, db_client)

    # --- Buy-ins ---
    buyins_resp = (
        db_client.table('buyin')
        .select('player_id, monto')
        .eq('session_id', session_id)
        .execute()
    )
    total_buyins: dict[str, int] = {}
    for row in buyins_resp.data:
        pid = row['player_id']
        total_buyins[pid] = total_buyins.get(pid, 0) + row['monto']

    # --- Cash-outs ---
    cashouts_resp = (
        db_client.table('cashout')
        .select('player_id, monto')
        .eq('session_id', session_id)
        .execute()
    )
    cashout_map: dict[str, int] = {
        row['player_id']: row['monto'] for row in cashouts_resp.data
    }

    # --- Balances ---
    balances = []
    for pid in player_ids:
        buyin_total = total_buyins.get(pid, 0)
        cashout_val = cashout_map.get(pid, 0)
        info = profiles.get(pid, {})
        balances.append({
            'player_id': pid,
            'nombre': info.get('nombre', pid),
            'total_buyins': buyin_total,
            'cashout': cashout_val,
            'neto': cashout_val - buyin_total,
        })

    # --- Settlements with enrichment ---
    settlements_resp = (
        db_client.table('settlement')
        .select('*')
        .eq('session_id', session_id)
        .execute()
    )

    # Resolve any settlement participants not yet in the map
    extra_ids = [
        pid for row in settlements_resp.data
        for pid in (row['deudor_id'], row['acreedor_id'])
        if pid not in profiles
    ]
    if extra_ids:
        extra = resolve_player_map(list(set(extra_ids)), db_client)
        profiles.update(extra)

    enriched_settlements = []
    for row in settlements_resp.data:
        acreedor_profile = profiles.get(row['acreedor_id'], {})
        deudor_profile = profiles.get(row['deudor_id'], {})
        enriched_settlements.append({
            **row,
            'alias_acreedor': acreedor_profile.get('alias_pago'),
            'nombre_acreedor': acreedor_profile.get('nombre'),
            'nombre_deudor': deudor_profile.get('nombre'),
        })

    return {
        'session': session,
        'balances': balances,
        'settlements': enriched_settlements,
    }
