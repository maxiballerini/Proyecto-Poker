"""
Unit tests for the settlement algorithm.
These are pure function tests — no database required.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.settlement import compute_settlements_from_netos


def test_simple_two_player():
    """
    A buys in 10000, cashes out 15000 -> neto +5000
    B buys in 10000, cashes out 5000  -> neto -5000
    Expected: 1 settlement, B->A, monto=5000
    """
    netos = {'player_A': 5000, 'player_B': -5000}
    result = compute_settlements_from_netos(netos)
    assert len(result) == 1
    assert result[0]['deudor_id'] == 'player_B'
    assert result[0]['acreedor_id'] == 'player_A'
    assert result[0]['monto'] == 5000


def test_three_player_minimization():
    """
    A: +6000, B: -2000, C: -4000
    Greedy: C->A 4000, B->A 2000 -> 2 transfers (optimal)
    """
    netos = {'player_A': 6000, 'player_B': -2000, 'player_C': -4000}
    result = compute_settlements_from_netos(netos)
    assert len(result) == 2
    total_paid = sum(r['monto'] for r in result)
    assert total_paid == 6000


def test_sum_is_zero():
    """The total amount paid to creditor A must equal A's net gain."""
    netos = {'A': 3000, 'B': -1000, 'C': -2000}
    result = compute_settlements_from_netos(netos)
    total = sum(r['monto'] for r in result if r['acreedor_id'] == 'A')
    assert total == 3000


def test_no_settlements_when_balanced():
    """If all netos are 0 there should be no settlements."""
    netos = {'A': 0, 'B': 0, 'C': 0}
    result = compute_settlements_from_netos(netos)
    assert result == []


def test_single_debtor_multiple_creditors():
    """
    One debtor owes two creditors.
    A: +3000, B: +2000, C: -5000
    C should pay A 3000 and B 2000.
    """
    netos = {'A': 3000, 'B': 2000, 'C': -5000}
    result = compute_settlements_from_netos(netos)
    assert len(result) == 2
    debts = {r['acreedor_id']: r['monto'] for r in result}
    assert debts['A'] == 3000
    assert debts['B'] == 2000
    for r in result:
        assert r['deudor_id'] == 'C'


def test_monto_is_integer():
    """All settlement amounts must be integers."""
    netos = {'A': 1500, 'B': -1500}
    result = compute_settlements_from_netos(netos)
    for r in result:
        assert isinstance(r['monto'], int)


def test_all_fields_present():
    """Each settlement dict must have deudor_id, acreedor_id, and monto."""
    netos = {'A': 1000, 'B': -1000}
    result = compute_settlements_from_netos(netos)
    assert len(result) == 1
    assert 'deudor_id' in result[0]
    assert 'acreedor_id' in result[0]
    assert 'monto' in result[0]
