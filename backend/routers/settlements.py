"""
Settlement routes: mark as paid, etc.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_current_user, get_service_client

router = APIRouter()


@router.patch("/settlements/{settlement_id}/pay")
def mark_settlement_paid(settlement_id: str, user=Depends(get_current_user)):
    """Deudor marks a settlement as paid. Notifies the acreedor if registered."""
    svc = get_service_client()
    resp = svc.table('settlement').select('*').eq('id', settlement_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Settlement no encontrado")
    s = resp.data
    if s['deudor_id'] != user.id:
        raise HTTPException(status_code=403, detail="Solo el deudor puede marcar como pagado")
    if s['estado'] == 'pagado':
        return s
    updated = svc.table('settlement').update({'estado': 'pagado'}).eq('id', settlement_id).execute()
    _try_notify_acreedor(s, user.id, svc)
    return updated.data[0]


def _try_notify_acreedor(settlement: dict, deudor_user_id: str, svc):
    acreedor_id = settlement['acreedor_id']
    prof_acreedor = svc.table('profile').select('user_id').eq('user_id', acreedor_id).execute()
    if not prof_acreedor.data:
        return
    prof_deudor = svc.table('profile').select('nombre').eq('user_id', deudor_user_id).execute()
    deudor_name = prof_deudor.data[0]['nombre'] if prof_deudor.data else 'Alguien'
    monto_fmt = f"${settlement['monto'] // 100:,}".replace(',', '.')
    try:
        svc.table('notification').insert({
            'user_id': acreedor_id,
            'type': 'payment',
            'message': f'{deudor_name} te marcó como pagado ({monto_fmt})',
            'data': {
                'settlement_id': settlement['id'],
                'session_id': settlement['session_id'],
                'monto': settlement['monto'],
            },
            'read': False,
        }).execute()
    except Exception:
        pass  # Don't fail the payment if notification insert fails
