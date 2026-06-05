from supabase import create_client, Client
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

security = HTTPBearer()


def get_anon_client() -> Client:
    """Returns Supabase client using the anon key. Used for user auth (login)."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_service_client() -> Client:
    """Returns Supabase client using the service_role key. Used for all DB operations server-side."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


# Module-level service client for use in routers/services
db = get_service_client()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """FastAPI dependency that validates the Bearer token and returns the authenticated user."""
    token = credentials.credentials
    try:
        client = get_service_client()
        response = client.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Token inválido")
        return response.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="No autorizado")
