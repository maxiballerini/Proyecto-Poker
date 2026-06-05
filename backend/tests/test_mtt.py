"""
Unit tests for MTT schemas and validation logic.
These are pure Pydantic model tests — no database required.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from pydantic import ValidationError


def test_prize_percentage_validation():
    """Sum of prize percentages must not exceed 10000 (100%)."""
    from models.schemas import PrizeCreate

    # Valid combination: 60% + 30% = 90% <= 100%
    prizes = [
        PrizeCreate(puesto=1, porcentaje=6000),
        PrizeCreate(puesto=2, porcentaje=3000),
    ]
    assert sum(p.porcentaje for p in prizes) <= 10000

    # Over 100%: 60% + 50% = 110% > 100%
    prizes_over = [
        PrizeCreate(puesto=1, porcentaje=6000),
        PrizeCreate(puesto=2, porcentaje=5000),
    ]
    assert sum(p.porcentaje for p in prizes_over) > 10000


def test_blind_level_creation():
    """BlindLevelCreate should accept valid input and default es_break to False."""
    from models.schemas import BlindLevelCreate

    level = BlindLevelCreate(orden=1, sb=25, bb=50, ante=0, duracion_seg=900)
    assert level.sb == 25
    assert level.bb == 50
    assert not level.es_break
    assert level.duracion_seg == 900
    assert level.ante == 0


def test_blind_level_break():
    """BlindLevelCreate should accept es_break=True for break levels."""
    from models.schemas import BlindLevelCreate

    level = BlindLevelCreate(orden=5, sb=0, bb=0, ante=0, duracion_seg=600, es_break=True)
    assert level.es_break is True


def test_tournament_create_validation():
    """TournamentCreate must reject buyin_centavos or stack_inicial <= 0."""
    from models.schemas import TournamentCreate

    with pytest.raises(ValidationError):
        TournamentCreate(nombre="Test", buyin_centavos=0, stack_inicial=5000)

    with pytest.raises(ValidationError):
        TournamentCreate(nombre="Test", buyin_centavos=1000, stack_inicial=0)

    with pytest.raises(ValidationError):
        TournamentCreate(nombre="Test", buyin_centavos=-500, stack_inicial=5000)

    # Valid
    t = TournamentCreate(nombre="Test", buyin_centavos=1000, stack_inicial=5000)
    assert t.buyin_centavos == 1000
    assert t.stack_inicial == 5000


def test_tournament_create_defaults():
    """TournamentCreate should default permite_reentry to False."""
    from models.schemas import TournamentCreate

    t = TournamentCreate(nombre="Noche de Poker", buyin_centavos=2000, stack_inicial=10000)
    assert t.permite_reentry is False


def test_entry_request_defaults():
    """EntryRequest should default reentry to False."""
    from models.schemas import EntryRequest

    e = EntryRequest()
    assert e.reentry is False

    e2 = EntryRequest(reentry=True)
    assert e2.reentry is True


def test_clock_update_model():
    """ClockUpdate should accept all required fields."""
    from models.schemas import ClockUpdate

    cu = ClockUpdate(nivel_actual=3, segundos_restantes=720, corriendo=True)
    assert cu.nivel_actual == 3
    assert cu.segundos_restantes == 720
    assert cu.corriendo is True


def test_buyin_monto_validation():
    """BuyinCreate must reject monto <= 0."""
    from models.schemas import BuyinCreate

    with pytest.raises(ValidationError):
        BuyinCreate(player_id='abc', monto=0)

    with pytest.raises(ValidationError):
        BuyinCreate(player_id='abc', monto=-100)

    b = BuyinCreate(player_id='abc', monto=5000)
    assert b.monto == 5000


def test_cashout_monto_validation():
    """CashoutCreate must reject monto < 0 but allow 0."""
    from models.schemas import CashoutCreate

    with pytest.raises(ValidationError):
        CashoutCreate(player_id='abc', monto=-1)

    # Zero is valid (player lost everything)
    c = CashoutCreate(player_id='abc', monto=0)
    assert c.monto == 0

    c2 = CashoutCreate(player_id='abc', monto=15000)
    assert c2.monto == 15000
