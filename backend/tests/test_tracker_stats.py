"""
Unit tests for the personal tracker's statistics aggregation.
Pure function tests over plain dicts shaped like attach_torneo_detail() output —
no database required (mirrors test_tracker.py).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.tracker_stats_service import compute_stats, _streaks


def _cash(neto, duracion_min=60, fecha='2026-01-01', buyin=10000, cashout=None, modalidad='vivo', variante='NLHE'):
    return {
        'tipo': 'cash', 'modalidad': modalidad, 'variante': variante, 'fecha': fecha,
        'duracion_min': duracion_min, 'resultado_neto_centavos': neto,
        'buyin_total_centavos': buyin, 'cashout_centavos': cashout if cashout is not None else buyin + neto,
        'torneo': None, 'created_at': fecha,
    }


def _torneo(neto, fecha='2026-01-01', duracion_min=180, posicion=None, entrantes=None,
            premio_pozo=0, es_bounty=False, ganancia_bounty=0, bounties_cobrados=0,
            buyin=10000, comision=900, costo_total=10900):
    return {
        'tipo': 'torneo', 'modalidad': 'online', 'variante': 'NLHE', 'fecha': fecha,
        'duracion_min': duracion_min, 'resultado_neto_centavos': neto, 'created_at': fecha,
        'torneo': {
            'buyin_centavos': buyin, 'comision_centavos': comision, 'costo_total_centavos': costo_total,
            'premio_pozo_centavos': premio_pozo, 'es_bounty': es_bounty,
            'ganancia_bounty_centavos': ganancia_bounty, 'bounties_cobrados': bounties_cobrados,
            'posicion_final': posicion, 'entrantes_totales': entrantes,
        },
    }


def test_streaks_distinguish_winning_losing_and_ties():
    chrono = [_cash(100), _cash(50), _cash(-10), _cash(0), _cash(20), _cash(30), _cash(40)]
    racha_actual, mejor_ganadora, peor_perdedora = _streaks(chrono)
    assert mejor_ganadora == 3       # la racha final de 20/30/40
    assert peor_perdedora == 1       # la sesión de -10, cortada por el empate
    assert racha_actual == 3         # racha ganadora vigente al final


def test_general_gananciahora_y_pct_ganadoras():
    sessions = [_cash(6000, duracion_min=60), _cash(-3000, duracion_min=60)]
    stats = compute_stats(sessions)
    assert stats.general.total_sesiones == 2
    assert stats.general.resultado_neto_centavos == 3000
    assert stats.general.horas_jugadas == 2.0
    assert stats.general.ganancia_hora_centavos == 1500.0  # 3000 / 2 horas
    assert stats.general.pct_ganadoras == 50.0
    assert stats.general.mejor_sesion_centavos == 6000
    assert stats.general.peor_sesion_centavos == -3000


def test_torneos_itm_y_roi():
    """2 torneos jugados, 1 cobra premio (ITM 50%); ROI sobre costo total."""
    sessions = [
        _torneo(neto=5000 - 10900, posicion=3, entrantes=20, premio_pozo=5000, costo_total=10900, buyin=10000),
        _torneo(neto=-10900, posicion=15, entrantes=20, premio_pozo=0, costo_total=10900, buyin=10000),
    ]
    stats = compute_stats(sessions)
    assert stats.torneos.jugados == 2
    assert stats.torneos.cashes == 1
    assert stats.torneos.pct_itm == 50.0
    assert stats.torneos.total_invertido_centavos == 21800
    assert stats.torneos.total_retornado_centavos == 5000
    assert stats.torneos.roi_pct == round((5000 - 21800) / 21800 * 100, 1)
    assert stats.torneos.posicion_promedio == 9.0
    assert stats.torneos.pct_mesa_final == 50.0  # solo el de posición 3 entra en mesa final (<=9)


def test_bounty_stats_separan_pozo_de_recompensas():
    """El torneo bounty gana 0 del pozo pero 15000 en KOs: el % vía bounty debe ser 100."""
    sessions = [
        _torneo(neto=15000 - 10900, premio_pozo=0, es_bounty=True,
                ganancia_bounty=15000, bounties_cobrados=3, costo_total=10900),
        _torneo(neto=-10900, es_bounty=False, costo_total=10900),
    ]
    stats = compute_stats(sessions)
    assert stats.bounty.jugados == 1
    assert stats.bounty.pct_sobre_torneos == 50.0
    assert stats.bounty.ganancia_bounty_centavos == 15000
    assert stats.bounty.bounties_cobrados == 3
    assert stats.bounty.valor_promedio_bounty_centavos == 5000.0
    assert stats.bounty.pct_resultado_via_bounty == 100.0


def test_breakdown_por_tipo_y_modalidad():
    sessions = [
        _cash(5000, modalidad='vivo'),
        _cash(-2000, modalidad='online'),
        _torneo(neto=-10900, fecha='2026-01-02'),
    ]
    stats = compute_stats(sessions)
    por_tipo = {item.clave: item for item in stats.por_tipo}
    assert por_tipo['Cash'].sesiones == 2
    assert por_tipo['Cash'].resultado_neto_centavos == 3000
    assert por_tipo['Torneo'].resultado_neto_centavos == -10900

    por_modalidad = {item.clave: item for item in stats.por_modalidad}
    assert por_modalidad['En vivo'].sesiones == 1
    assert por_modalidad['Online'].sesiones == 2  # 1 cash online + 1 torneo online


def test_cash_stats_promedios():
    sessions = [_cash(5000, buyin=10000, cashout=15000), _cash(-3000, buyin=8000, cashout=5000)]
    stats = compute_stats(sessions)
    assert stats.cash.sesiones == 2
    assert stats.cash.buyin_promedio_centavos == 9000.0
    assert stats.cash.cashout_promedio_centavos == 10000.0
