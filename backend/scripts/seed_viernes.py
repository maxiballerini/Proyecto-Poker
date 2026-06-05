"""
Seed 10 fake closed sessions for 'Viernes de Poker' group.
Run from backend/: python scripts/seed_viernes.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import random
import uuid
from datetime import date, timedelta
from db.supabase_client import get_service_client

GRUPO_ID = '0a3454d6-1627-4aff-9033-e10f5557406c'
HOST_ID  = 'c1421ec8-44c7-4457-8c13-4dcabd7a7cc1'

PLAYERS = {
    'Nacho': '71a69a28-7769-460c-884d-201802904133',
    'Fede':  'e494100a-9a49-491c-9ef9-5ba511b74295',
    'Mati':  '84d05c04-1a6c-406c-ac90-1695945602fc',
    'Lucas': '6b3e7a3f-1c4e-4fc6-b94c-c766a286c99c',
    'Sofi':  '15eec1f8-eecd-43c2-8fd6-d2842bc51032',
    'Caro':  '763ca8d2-2a3c-4549-b9c5-d816773a07ad',
    'Bruno': '6a810b19-fbf3-46bb-b3bd-63907b0a49b0',
    'Rodri': 'f19d0aed-80af-4e11-b714-842f2e199cf0',
}

# Each session: (nombre, fecha_offset_days_ago, players_subset, outcomes_centavos)
# outcomes: positive = net winner, negative = net loser (must sum to 0 per session)
SESSIONS = [
    {
        'nombre': 'Viernes 7 de marzo',
        'days_ago': 90,
        'players': ['Nacho','Fede','Mati','Lucas','Sofi','Caro'],
        'outcomes': [2500000, -500000, -1000000, 1500000, -1500000, -1000000],
    },
    {
        'nombre': 'Viernes 14 de marzo',
        'days_ago': 83,
        'players': ['Nacho','Fede','Bruno','Rodri','Caro','Mati'],
        'outcomes': [-800000, 3000000, -1200000, 500000, -1000000, -500000],
    },
    {
        'nombre': 'Viernes 21 de marzo',
        'days_ago': 76,
        'players': ['Lucas','Sofi','Bruno','Rodri','Nacho','Fede','Mati'],
        'outcomes': [3500000, -1000000, -500000, -2000000, 1000000, -500000, -500000],
    },
    {
        'nombre': 'Viernes 4 de abril',
        'days_ago': 62,
        'players': ['Nacho','Fede','Mati','Caro','Bruno'],
        'outcomes': [-1500000, 2000000, 500000, -500000, -500000],
    },
    {
        'nombre': 'Viernes 11 de abril',
        'days_ago': 55,
        'players': ['Rodri','Lucas','Sofi','Nacho','Fede','Bruno','Caro'],
        'outcomes': [4000000, -1000000, -500000, -1500000, -200000, -300000, -500000],
    },
    {
        'nombre': 'Viernes 25 de abril',
        'days_ago': 41,
        'players': ['Nacho','Mati','Lucas','Sofi','Caro','Bruno'],
        'outcomes': [1800000, -600000, 2200000, -1500000, -1000000, -900000],
    },
    {
        'nombre': 'Viernes 2 de mayo',
        'days_ago': 34,
        'players': ['Fede','Rodri','Mati','Nacho','Lucas','Sofi','Caro','Bruno'],
        'outcomes': [5000000, -1000000, -500000, -1500000, 500000, -1000000, -700000, -800000],
    },
    {
        'nombre': 'Viernes 9 de mayo',
        'days_ago': 27,
        'players': ['Nacho','Fede','Mati','Rodri','Caro'],
        'outcomes': [2500000, -1000000, -500000, 500000, -1500000],
    },
    {
        'nombre': 'Viernes 16 de mayo',
        'days_ago': 20,
        'players': ['Lucas','Sofi','Bruno','Rodri','Nacho','Fede'],
        'outcomes': [-2000000, 3500000, 500000, -1000000, -500000, -500000],
    },
    {
        'nombre': 'Viernes 23 de mayo',
        'days_ago': 13,
        'players': ['Nacho','Fede','Mati','Lucas','Sofi','Caro','Bruno','Rodri'],
        'outcomes': [6000000, -1500000, -500000, -500000, -1000000, -1000000, -700000, -800000],
    },
]

def run():
    svc = get_service_client()
    today = date.today()

    for s in SESSIONS:
        fecha = (today - timedelta(days=s['days_ago'])).isoformat()
        players = s['players']
        outcomes = s['outcomes']
        assert sum(outcomes) == 0, f"Outcomes don't sum to 0 for {s['nombre']}: {sum(outcomes)}"

        # Create session
        session_resp = svc.table('cash_session').insert({
            'id': str(uuid.uuid4()),
            'host_id': HOST_ID,
            'grupo_id': GRUPO_ID,
            'nombre': s['nombre'],
            'fecha': fecha,
            'lugar': 'Casa de Nacho',
            'estado': 'cerrada',
        }).execute()
        sid = session_resp.data[0]['id']

        # Create session_player entries
        for name in players:
            pid = PLAYERS[name]
            svc.table('session_player').insert({
                'session_id': sid,
                'player_id': pid,
            }).execute()

        # Create buyins and cashouts based on outcomes
        for i, name in enumerate(players):
            pid = PLAYERS[name]
            outcome = outcomes[i]
            # Base buy-in: 1000 pesos = 100000 centavos
            base_buyin = 100000

            if outcome >= 0:
                # Winner: bought in base amount, cashed out base + winnings
                buyin = base_buyin
                cashout = base_buyin + outcome
            else:
                # Loser: bought in enough to cover losses, cashed out 0 or small amount
                loss = abs(outcome)
                if loss <= base_buyin:
                    buyin = base_buyin
                    cashout = base_buyin - loss
                else:
                    # Multi-buyin for big losers
                    buyin = base_buyin
                    remaining_loss = loss - base_buyin
                    # Add rebuy
                    buyin2 = remaining_loss
                    # Insert first buyin
                    svc.table('buyin').insert({
                        'session_id': sid, 'player_id': pid, 'monto': buyin
                    }).execute()
                    svc.table('buyin').insert({
                        'session_id': sid, 'player_id': pid, 'monto': buyin2
                    }).execute()
                    if loss < base_buyin + buyin2:
                        cashout = base_buyin + buyin2 - loss
                    else:
                        cashout = 0
                    svc.table('cashout').insert({
                        'session_id': sid, 'player_id': pid, 'monto': cashout
                    }).execute()
                    continue

            svc.table('buyin').insert({
                'session_id': sid, 'player_id': pid, 'monto': buyin
            }).execute()
            svc.table('cashout').insert({
                'session_id': sid, 'player_id': pid, 'monto': cashout
            }).execute()

        print(f"Created: {s['nombre']} (id: {sid[:8]})")

    print("\nDone! 10 sessions created.")

if __name__ == '__main__':
    run()
