"""
Aggregation engine for the personal tracker's statistics dashboard.
Pure functions over already-fetched session rows (with `torneo` attached via
attach_torneo_detail) — no DB access here, so they're easy to unit test
(mirrors tracker_service.compute_resultado_neto).
"""
from __future__ import annotations

import statistics
from typing import Callable, Optional

from models.tracker_schemas import (
    BreakdownItem,
    StatsBounty,
    StatsCash,
    StatsGeneral,
    StatsTorneos,
    TrackerStatsResponse,
)


def _pct(numer: int, denom: int) -> Optional[float]:
    if denom == 0:
        return None
    return round(numer / denom * 100, 1)


def _avg(values: list[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _ganancia_por_hora(neto_centavos: int, minutos: int) -> Optional[float]:
    if minutos <= 0:
        return None
    return round(neto_centavos / (minutos / 60), 1)


def _streaks(sessions_chrono: list[dict]) -> tuple[int, int, int]:
    """Devuelve (racha_actual, mejor_racha_ganadora, peor_racha_perdedora).
    `sessions_chrono` debe estar ordenado de más antigua a más nueva.
    Un resultado en cero corta cualquier racha en curso (no cuenta como ganadora ni perdedora)."""
    mejor_ganadora = 0
    peor_perdedora = 0
    actual = 0
    signo_actual = 0

    for s in sessions_chrono:
        neto = s['resultado_neto_centavos']
        signo = 1 if neto > 0 else (-1 if neto < 0 else 0)
        if signo == 0:
            actual = 0
            signo_actual = 0
            continue
        actual = actual + 1 if signo == signo_actual else 1
        signo_actual = signo
        if signo == 1:
            mejor_ganadora = max(mejor_ganadora, actual)
        else:
            peor_perdedora = max(peor_perdedora, actual)

    return actual * signo_actual, mejor_ganadora, peor_perdedora


def _general(sessions: list[dict]) -> StatsGeneral:
    netos = [s['resultado_neto_centavos'] for s in sessions]
    minutos_total = sum(s.get('duracion_min') or 0 for s in sessions)
    neto_total = sum(netos)
    ganadoras = sum(1 for n in netos if n > 0)

    chrono = sorted(sessions, key=lambda s: (s['fecha'], s.get('created_at') or ''))
    racha_actual, mejor_racha, peor_racha = _streaks(chrono)

    return StatsGeneral(
        total_sesiones=len(sessions),
        resultado_neto_centavos=neto_total,
        horas_jugadas=round(minutos_total / 60, 1),
        ganancia_hora_centavos=_ganancia_por_hora(neto_total, minutos_total),
        pct_ganadoras=_pct(ganadoras, len(sessions)) or 0.0,
        mejor_sesion_centavos=max(netos) if netos else None,
        peor_sesion_centavos=min(netos) if netos else None,
        racha_actual=racha_actual,
        mejor_racha_ganadora=mejor_racha,
        peor_racha_perdedora=peor_racha,
        desvio_estandar_centavos=(round(statistics.pstdev(netos), 1) if len(netos) > 1 else None),
    )


def _breakdown(sessions: list[dict], key_fn: Callable[[dict], str]) -> list[BreakdownItem]:
    grupos: dict[str, list[dict]] = {}
    for s in sessions:
        grupos.setdefault(key_fn(s), []).append(s)

    items = [
        BreakdownItem(
            clave=clave,
            sesiones=len(grupo),
            resultado_neto_centavos=sum(s['resultado_neto_centavos'] for s in grupo),
            ganancia_hora_centavos=_ganancia_por_hora(
                sum(s['resultado_neto_centavos'] for s in grupo),
                sum(s.get('duracion_min') or 0 for s in grupo),
            ),
        )
        for clave, grupo in grupos.items()
    ]
    items.sort(key=lambda i: i.resultado_neto_centavos, reverse=True)
    return items


def _torneo_retorno(t: dict) -> int:
    return (t['torneo'].get('premio_pozo_centavos') or 0) + (t['torneo'].get('ganancia_bounty_centavos') or 0)


def _torneos(torneos: list[dict]) -> StatsTorneos:
    cashes = sum(1 for t in torneos if _torneo_retorno(t) > 0)
    costo_total = sum(t['torneo']['costo_total_centavos'] for t in torneos)
    retorno_total = sum(_torneo_retorno(t) for t in torneos)
    posiciones = [
        (t['torneo']['posicion_final'], t['torneo']['entrantes_totales'])
        for t in torneos
        if t['torneo'].get('posicion_final') and t['torneo'].get('entrantes_totales')
    ]
    mesas_finales = sum(1 for pos, _ in posiciones if pos <= 9)
    victorias = sum(1 for pos, _ in posiciones if pos == 1)

    return StatsTorneos(
        jugados=len(torneos),
        cashes=cashes,
        pct_itm=_pct(cashes, len(torneos)),
        roi_pct=(round((retorno_total - costo_total) / costo_total * 100, 1) if costo_total else None),
        buyin_promedio_centavos=_avg([t['torneo']['buyin_centavos'] for t in torneos]),
        total_invertido_centavos=costo_total,
        total_retornado_centavos=retorno_total,
        posicion_promedio=_avg([pos for pos, _ in posiciones]),
        pct_mesa_final=_pct(mesas_finales, len(posiciones)),
        pct_victorias=_pct(victorias, len(posiciones)),
    )


def _bounty(torneos: list[dict]) -> StatsBounty:
    bounty_torneos = [t for t in torneos if t['torneo'].get('es_bounty')]
    ganancia_bounty = sum(t['torneo'].get('ganancia_bounty_centavos') or 0 for t in bounty_torneos)
    ganancia_pozo = sum(t['torneo'].get('premio_pozo_centavos') or 0 for t in bounty_torneos)
    bounties_cobrados = sum(t['torneo'].get('bounties_cobrados') or 0 for t in bounty_torneos)
    costo_total = sum(t['torneo']['costo_total_centavos'] for t in bounty_torneos)
    retorno_total = ganancia_bounty + ganancia_pozo

    return StatsBounty(
        jugados=len(bounty_torneos),
        pct_sobre_torneos=_pct(len(bounty_torneos), len(torneos)),
        ganancia_bounty_centavos=ganancia_bounty,
        bounties_cobrados=bounties_cobrados,
        valor_promedio_bounty_centavos=(
            round(ganancia_bounty / bounties_cobrados, 1) if bounties_cobrados else None
        ),
        pct_resultado_via_bounty=(_pct(ganancia_bounty, retorno_total) if retorno_total > 0 else None),
        roi_pct=(round((retorno_total - costo_total) / costo_total * 100, 1) if costo_total else None),
    )


def _cash(cash_sessions: list[dict]) -> StatsCash:
    neto_total = sum(s['resultado_neto_centavos'] for s in cash_sessions)
    minutos_total = sum(s.get('duracion_min') or 0 for s in cash_sessions)
    return StatsCash(
        sesiones=len(cash_sessions),
        ganancia_hora_centavos=_ganancia_por_hora(neto_total, minutos_total),
        buyin_promedio_centavos=_avg([s['buyin_total_centavos'] for s in cash_sessions if s.get('buyin_total_centavos') is not None]),
        cashout_promedio_centavos=_avg([s['cashout_centavos'] for s in cash_sessions if s.get('cashout_centavos') is not None]),
    )


def compute_stats(sessions: list[dict]) -> TrackerStatsResponse:
    """Computa el dashboard completo a partir de las sesiones del usuario
    (ya filtradas por período si corresponde, con `torneo` adjunto)."""
    cash_sessions = [s for s in sessions if s['tipo'] == 'cash']
    torneos = [s for s in sessions if s['tipo'] == 'torneo' and s.get('torneo')]

    return TrackerStatsResponse(
        general=_general(sessions),
        por_tipo=_breakdown(sessions, lambda s: 'Cash' if s['tipo'] == 'cash' else 'Torneo'),
        por_modalidad=_breakdown(sessions, lambda s: 'Online' if s['modalidad'] == 'online' else 'En vivo'),
        por_variante=_breakdown(sessions, lambda s: s.get('variante') or 'Sin especificar'),
        torneos=_torneos(torneos),
        bounty=_bounty(torneos),
        cash=_cash(cash_sessions),
    )
