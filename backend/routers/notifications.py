"""
Notification routes: fetch, mark read.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from db.supabase_client import get_current_user, get_service_client

router = APIRouter()


@router.get("/notifications")
def get_notifications(user=Depends(get_current_user)):
    svc = get_service_client()
    resp = (
        svc.table('notification')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', desc=True)
        .limit(50)
        .execute()
    )
    return resp.data


@router.patch("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    svc = get_service_client()
    svc.table('notification').update({'read': True}).eq('id', notif_id).eq('user_id', user.id).execute()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(user=Depends(get_current_user)):
    svc = get_service_client()
    svc.table('notification').update({'read': True}).eq('user_id', user.id).eq('read', False).execute()
    return {"ok": True}
