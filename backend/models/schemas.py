from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# Auth models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    nombre: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    nombre: str
    alias_pago: Optional[str] = None


class ProfileUpdate(BaseModel):
    nombre: Optional[str] = None
    alias_pago: Optional[str] = None


# ---------------------------------------------------------------------------
# Cash models
# ---------------------------------------------------------------------------

class GrupoCreate(BaseModel):
    nombre: str


class GrupoResponse(BaseModel):
    id: str
    host_id: str
    nombre: str
    created_at: datetime
    total_partidas: int = 0
    total_miembros: int = 0


class GrupoDetail(BaseModel):
    grupo: GrupoResponse
    miembros: List[PlayerInfo]
    partidas: List['SessionResponse']


class SessionCreate(BaseModel):
    nombre: Optional[str] = None
    fecha: Optional[date] = None
    lugar: Optional[str] = None


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    host_id: str
    grupo_id: str
    nombre: str
    fecha: date
    lugar: Optional[str] = None
    estado: str
    created_at: datetime


class AddPlayerRequest(BaseModel):
    player_id: str


class GuestPlayerCreate(BaseModel):
    nombre: str
    alias_pago: Optional[str] = None


class GuestLinkRequest(BaseModel):
    user_id: str


class InviteInfo(BaseModel):
    token: str
    grupo_id: str
    grupo_nombre: str


class GuestPlayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nombre: str
    alias_pago: Optional[str] = None


class PlayerInfo(BaseModel):
    id: str
    nombre: str
    alias_pago: Optional[str] = None
    is_guest: bool = False


class BuyinCreate(BaseModel):
    player_id: str
    monto: int  # centavos, must be > 0

    @field_validator('monto')
    @classmethod
    def monto_positivo(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('monto debe ser positivo')
        return v


class BuyinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    player_id: str
    player_nombre: Optional[str] = None
    monto: int
    created_at: datetime


class CashoutCreate(BaseModel):
    player_id: str
    monto: int  # centavos, >= 0

    @field_validator('monto')
    @classmethod
    def monto_no_negativo(cls, v: int) -> int:
        if v < 0:
            raise ValueError('monto no puede ser negativo')
        return v


class CashoutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    player_id: str
    player_nombre: Optional[str] = None
    monto: int
    created_at: datetime


class PlayerBalance(BaseModel):
    player_id: str
    nombre: str
    total_buyins: int
    cashout: int
    neto: int  # cashout - total_buyins


class SettlementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    deudor_id: str
    acreedor_id: str
    monto: int
    estado: str
    alias_acreedor: Optional[str] = None
    nombre_acreedor: Optional[str] = None
    nombre_deudor: Optional[str] = None


class SessionSummary(BaseModel):
    session: SessionResponse
    balances: List[PlayerBalance]
    settlements: List[SettlementResponse]


# ---------------------------------------------------------------------------
# MTT models
# ---------------------------------------------------------------------------

class TournamentCreate(BaseModel):
    nombre: str
    fecha: Optional[date] = None
    buyin_centavos: int
    stack_inicial: int
    permite_reentry: bool = False

    @field_validator('buyin_centavos', 'stack_inicial')
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('debe ser positivo')
        return v


class TournamentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    host_id: str
    nombre: str
    fecha: date
    buyin_centavos: int
    stack_inicial: int
    permite_reentry: bool
    estado: str
    total_entradas: int
    jugadores_activos: int
    pozo_calculado: int  # total_entradas * buyin_centavos


class BlindLevelCreate(BaseModel):
    orden: int
    sb: int
    bb: int
    ante: int = 0
    duracion_seg: int
    es_break: bool = False


class BlindLevelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tournament_id: str
    orden: int
    sb: int
    bb: int
    ante: int
    duracion_seg: int
    es_break: bool


class PrizeCreate(BaseModel):
    puesto: int
    porcentaje: int  # centésimas: 5000 = 50.00%


class PrizeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tournament_id: str
    puesto: int
    porcentaje: int
    monto_calculado: int  # porcentaje * pozo // 10000


class ClockState(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tournament_id: str
    nivel_actual: int
    segundos_restantes: int
    corriendo: bool
    updated_at: datetime
    nivel_info: Optional[BlindLevelResponse] = None


class ClockUpdate(BaseModel):
    nivel_actual: int
    segundos_restantes: int
    corriendo: bool


class EntryRequest(BaseModel):
    reentry: bool = False


class TournamentDetail(BaseModel):
    tournament: TournamentResponse
    blind_levels: List[BlindLevelResponse]
    prizes: List[PrizeResponse]
    clock: Optional[ClockState] = None
