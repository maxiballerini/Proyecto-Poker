"""
Authentication and profile routes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.supabase_client import get_anon_client, get_service_client, get_current_user
from models.schemas import (
    LoginRequest,
    ProfileResponse,
    ProfileUpdate,
    RegisterRequest,
)

router = APIRouter()


@router.post("/register", response_model=ProfileResponse, status_code=201)
def register(body: RegisterRequest):
    """
    Register a new user and create their profile row.
    Uses the service client to create the auth user with user_metadata,
    then upserts the profile table defensively (a DB trigger should also handle this).
    """
    service = get_service_client()

    try:
        auth_resp = service.auth.admin.create_user({
            'email': body.email,
            'password': body.password,
            'user_metadata': {'nombre': body.nombre},
            'email_confirm': True,
        })
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    user = auth_resp.user
    if not user:
        raise HTTPException(status_code=400, detail="No se pudo crear el usuario")

    # Upsert profile — the DB trigger may already have run, so we upsert defensively.
    profile_data: dict = {
        'user_id': user.id,
        'nombre': body.nombre,
        'email': body.email.lower().strip(),
    }
    if body.nickname:
        profile_data['nickname'] = body.nickname.lower().strip()
    try:
        service.table('profile').upsert(profile_data).execute()
    except Exception:
        try:
            service.table('profile').upsert({'user_id': user.id, 'nombre': body.nombre}).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error al crear perfil: {exc}")

    profile_resp = (
        service.table('profile')
        .select('user_id, nombre, alias_pago, nickname')
        .eq('user_id', user.id)
        .single()
        .execute()
    )

    if not profile_resp.data:
        raise HTTPException(status_code=500, detail="Perfil no encontrado tras creación")

    return ProfileResponse(**profile_resp.data)


@router.post("/login")
def login(body: LoginRequest):
    """
    Authenticate a user with email and password.
    Returns access_token, token_type, and user info.
    """
    anon = get_anon_client()

    try:
        auth_resp = anon.auth.sign_in_with_password({
            'email': body.email,
            'password': body.password,
        })
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    if not auth_resp.session:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    return {
        'access_token': auth_resp.session.access_token,
        'token_type': 'bearer',
        'user': {
            'id': auth_resp.user.id,
            'email': auth_resp.user.email,
        },
    }


@router.get("/me", response_model=ProfileResponse)
def me(user=Depends(get_current_user)):
    """Return the authenticated user's profile."""
    service = get_service_client()

    profile_resp = (
        service.table('profile')
        .select('user_id, nombre, alias_pago, nickname')
        .eq('user_id', user.id)
        .single()
        .execute()
    )

    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    return ProfileResponse(**profile_resp.data)


@router.put("/me", response_model=ProfileResponse)
def update_me(body: ProfileUpdate, user=Depends(get_current_user)):
    """Update the authenticated user's profile (only fields that are not None)."""
    updates = body.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    service = get_service_client()

    try:
        service.table('profile').update(updates).eq('user_id', user.id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    profile_resp = (
        service.table('profile')
        .select('user_id, nombre, alias_pago, nickname')
        .eq('user_id', user.id)
        .single()
        .execute()
    )

    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    return ProfileResponse(**profile_resp.data)
