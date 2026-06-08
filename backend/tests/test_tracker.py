"""
Unit tests for the personal tracker's net-result calculation.
Pure function tests — no database required (mirrors test_cash.py).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.tracker_schemas import PokerSessionCreate, TournamentEntryData
from services.tracker_service import compute_resultado_neto


def _cash(buyin, cashout):
    return PokerSessionCreate(
        tipo='cash', modalidad='vivo',
        buyin_total_centavos=buyin, cashout_centavos=cashout,
    )


def _torneo(**kwargs):
    defaults = dict(
        buyin_centavos=10000, comision_centavos=900, rebuys=0, addons=0,
        premio_pozo_centavos=0, ganancia_bounty_centavos=0,
    )
    defaults.update(kwargs)
    return PokerSessionCreate(
        tipo='torneo', modalidad='online', torneo=TournamentEntryData(**defaults),
    )


def test_cash_neto_positivo():
    neto, costo = compute_resultado_neto(_cash(buyin=10000, cashout=15000))
    assert neto == 5000
    assert costo is None


def test_cash_neto_negativo():
    neto, costo = compute_resultado_neto(_cash(buyin=10000, cashout=4000))
    assert neto == -6000


def test_torneo_no_bounty_costo_y_neto():
    """buy-in 100 + comision 9, sin rebuys, gana 50 del pozo -> costo 10900, neto -6000"""
    neto, costo = compute_resultado_neto(_torneo(premio_pozo_centavos=5000))
    assert costo == 10900
    assert neto == 5000 - 10900


def test_torneo_con_rebuys_y_addons_en_costo():
    """rebuys/addons se asumen al precio del buy-in: costo = buyin + comision + (rebuys+addons)*buyin"""
    neto, costo = compute_resultado_neto(_torneo(rebuys=2, addons=1, premio_pozo_centavos=0))
    assert costo == 10000 + 900 + 3 * 10000
    assert neto == -costo


def test_torneo_bounty_separa_pozo_y_recompensas():
    """El resultado de un torneo bounty suma premio de pozo + ganancia por bounties, ambos guardados por separado."""
    neto, costo = compute_resultado_neto(
        _torneo(premio_pozo_centavos=3000, ganancia_bounty_centavos=7000)
    )
    assert costo == 10900
    assert neto == (3000 + 7000) - 10900
    assert neto == -900


def test_torneo_bounty_gana_solo_por_recompensas():
    """Caso típico bounty: no hace el dinero del pozo pero igual gana neto por knockouts."""
    neto, costo = compute_resultado_neto(
        _torneo(premio_pozo_centavos=0, ganancia_bounty_centavos=15000)
    )
    assert neto == 15000 - costo
    assert neto > 0


def test_resultado_neto_es_entero():
    neto, _ = compute_resultado_neto(_cash(buyin=10000, cashout=12345))
    assert isinstance(neto, int)
