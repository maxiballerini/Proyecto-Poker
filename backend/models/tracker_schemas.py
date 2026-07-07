"""
Schemas for the personal poker tracker (sessions, bankroll, tournament/bounty detail).
Kept separate from schemas.py to stay under the 500-line guideline.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

SessionTipo = Literal['cash', 'torneo']
Modalidad = Literal['online', 'vivo']
TipoBounty = Literal['normal', 'progressive']
Estructura = Literal['regular', 'turbo', 'hyper', 'deepstack']
TransaccionTipo = Literal['deposito', 'retiro', 'transferencia_entrada', 'transferencia_salida']


# ---------------------------------------------------------------------------
# Bankroll
# ---------------------------------------------------------------------------

class BankrollCreate(BaseModel):
    nombre: str
    moneda: str = 'ARS'
    saldo_inicial_centavos: int = 0


class BankrollUpdate(BaseModel):
    nombre: Optional[str] = None
    moneda: Optional[str] = None


class BankrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    nombre: str
    moneda: str
    saldo_inicial_centavos: int
    saldo_actual_centavos: int
    created_at: datetime


class BankrollTransactionCreate(BaseModel):
    tipo: TransaccionTipo
    monto_centavos: int
    nota: Optional[str] = None
    fecha: Optional[date] = None

    @field_validator('monto_centavos')
    @classmethod
    def monto_positivo(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('monto debe ser positivo')
        return v


class BankrollTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bankroll_id: str
    tipo: str
    monto_centavos: int
    nota: Optional[str] = None
    fecha: date
    created_at: datetime


# ---------------------------------------------------------------------------
# Goals — monthly profit / hours targets ('YYYY-MM' periods)
# ---------------------------------------------------------------------------

class GoalUpsert(BaseModel):
    periodo: str
    objetivo_ganancia_centavos: Optional[int] = None
    objetivo_horas: Optional[float] = None

    @field_validator('periodo')
    @classmethod
    def periodo_formato(cls, v: str) -> str:
        import re
        if not re.match(r'^\d{4}-\d{2}$', v):
            raise ValueError('periodo debe tener formato YYYY-MM')
        return v

    @model_validator(mode='after')
    def al_menos_un_objetivo(self):
        if self.objetivo_ganancia_centavos is None and self.objetivo_horas is None:
            raise ValueError('definí al menos un objetivo: ganancia y/o horas')
        if self.objetivo_ganancia_centavos is not None and self.objetivo_ganancia_centavos < 0:
            raise ValueError('el objetivo de ganancia no puede ser negativo')
        if self.objetivo_horas is not None and self.objetivo_horas < 0:
            raise ValueError('el objetivo de horas no puede ser negativo')
        return self


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    periodo: str
    objetivo_ganancia_centavos: Optional[int] = None
    objetivo_horas: Optional[float] = None
    progreso_ganancia_centavos: int
    progreso_horas: float
    created_at: datetime


# ---------------------------------------------------------------------------
# Personal sessions — cash and tournament share poker_session;
# tournament-only fields travel in a nested "torneo" block (-> tournament_entry)
# ---------------------------------------------------------------------------

class TournamentEntryData(BaseModel):
    nombre_torneo: Optional[str] = None
    buyin_centavos: int = 0
    comision_centavos: int = 0
    rebuys: int = 0
    addons: int = 0
    es_bounty: bool = False
    tipo_bounty: Optional[TipoBounty] = None
    bounties_cobrados: int = 0
    ganancia_bounty_centavos: int = 0
    premio_pozo_centavos: int = 0
    entrantes_totales: Optional[int] = None
    posicion_final: Optional[int] = None
    estructura: Optional[Estructura] = None
    late_reg: bool = False

    @field_validator(
        'buyin_centavos', 'comision_centavos',
        'ganancia_bounty_centavos', 'premio_pozo_centavos',
    )
    @classmethod
    def no_negativo(cls, v: int) -> int:
        if v < 0:
            raise ValueError('no puede ser negativo')
        return v

    @field_validator('entrantes_totales', 'posicion_final')
    @classmethod
    def positivo_si_presente(cls, v):
        if v is not None and v <= 0:
            raise ValueError('debe ser positivo')
        return v


class TournamentEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: str
    nombre_torneo: Optional[str] = None
    buyin_centavos: int
    comision_centavos: int
    rebuys: int
    addons: int
    costo_total_centavos: int
    es_bounty: bool
    tipo_bounty: Optional[str] = None
    bounties_cobrados: int
    ganancia_bounty_centavos: int
    premio_pozo_centavos: int
    entrantes_totales: Optional[int] = None
    posicion_final: Optional[int] = None
    estructura: Optional[str] = None
    late_reg: bool


class PokerSessionCreate(BaseModel):
    bankroll_id: Optional[str] = None
    tipo: SessionTipo
    modalidad: Modalidad
    variante: Optional[str] = None
    fecha: Optional[date] = None
    ubicacion: Optional[str] = None
    duracion_min: Optional[int] = None
    notas: Optional[str] = None
    mood: Optional[int] = None
    # cash-only (required when tipo == 'cash')
    stakes_sb_centavos: Optional[int] = None
    stakes_bb_centavos: Optional[int] = None
    buyin_total_centavos: Optional[int] = None
    cashout_centavos: Optional[int] = None
    mesa_size: Optional[int] = None
    # tournament-only (required when tipo == 'torneo')
    torneo: Optional[TournamentEntryData] = None

    @field_validator('mood')
    @classmethod
    def mood_rango(cls, v):
        if v is not None and not (1 <= v <= 5):
            raise ValueError('mood debe estar entre 1 y 5')
        return v

    @field_validator('duracion_min')
    @classmethod
    def duracion_no_negativa(cls, v):
        if v is not None and v < 0:
            raise ValueError('duracion_min no puede ser negativa')
        return v

    @model_validator(mode='after')
    def validar_segun_tipo(self):
        if self.tipo == 'cash':
            if self.buyin_total_centavos is None or self.cashout_centavos is None:
                raise ValueError('las sesiones cash requieren buyin_total_centavos y cashout_centavos')
            if self.buyin_total_centavos < 0 or self.cashout_centavos < 0:
                raise ValueError('los montos de cash no pueden ser negativos')
        elif self.torneo is None:
            raise ValueError('las sesiones de torneo requieren el detalle "torneo"')
        return self


class PokerSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    bankroll_id: Optional[str] = None
    tipo: str
    modalidad: str
    variante: Optional[str] = None
    fecha: date
    ubicacion: Optional[str] = None
    duracion_min: Optional[int] = None
    stakes_sb_centavos: Optional[int] = None
    stakes_bb_centavos: Optional[int] = None
    buyin_total_centavos: Optional[int] = None
    cashout_centavos: Optional[int] = None
    mesa_size: Optional[int] = None
    resultado_neto_centavos: int
    notas: Optional[str] = None
    mood: Optional[int] = None
    created_at: datetime
    torneo: Optional[TournamentEntryResponse] = None


class PokerSessionListResponse(BaseModel):
    sessions: List[PokerSessionResponse]


# ---------------------------------------------------------------------------
# Stats dashboard
# ---------------------------------------------------------------------------

class StatsGeneral(BaseModel):
    total_sesiones: int
    resultado_neto_centavos: int
    horas_jugadas: float
    ganancia_hora_centavos: Optional[float] = None
    pct_ganadoras: float
    mejor_sesion_centavos: Optional[int] = None
    peor_sesion_centavos: Optional[int] = None
    racha_actual: int
    mejor_racha_ganadora: int
    peor_racha_perdedora: int
    desvio_estandar_centavos: Optional[float] = None


class BreakdownItem(BaseModel):
    clave: str
    sesiones: int
    resultado_neto_centavos: int
    ganancia_hora_centavos: Optional[float] = None


class StatsTorneos(BaseModel):
    jugados: int
    cashes: int
    pct_itm: Optional[float] = None
    roi_pct: Optional[float] = None
    buyin_promedio_centavos: Optional[float] = None
    total_invertido_centavos: int
    total_retornado_centavos: int
    posicion_promedio: Optional[float] = None
    pct_mesa_final: Optional[float] = None
    pct_victorias: Optional[float] = None


class StatsBounty(BaseModel):
    jugados: int
    pct_sobre_torneos: Optional[float] = None
    ganancia_bounty_centavos: int
    bounties_cobrados: int
    valor_promedio_bounty_centavos: Optional[float] = None
    pct_resultado_via_bounty: Optional[float] = None
    roi_pct: Optional[float] = None


class StatsCash(BaseModel):
    sesiones: int
    ganancia_hora_centavos: Optional[float] = None
    buyin_promedio_centavos: Optional[float] = None
    cashout_promedio_centavos: Optional[float] = None


class TrackerStatsResponse(BaseModel):
    general: StatsGeneral
    por_tipo: List[BreakdownItem]
    por_modalidad: List[BreakdownItem]
    por_variante: List[BreakdownItem]
    torneos: StatsTorneos
    bounty: StatsBounty
    cash: StatsCash
