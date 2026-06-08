from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, cash, grupos, mtt, notifications, settlements, tracker

app = FastAPI(title="Poker Nights API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(grupos.router, tags=["grupos"])
app.include_router(cash.router, prefix="/cash", tags=["cash"])
app.include_router(mtt.router, prefix="/mtt", tags=["mtt"])
app.include_router(settlements.router, prefix="/cash", tags=["settlements"])
app.include_router(notifications.router, tags=["notifications"])
app.include_router(tracker.router, prefix="/tracker", tags=["tracker"])


@app.get("/health")
def health():
    return {"status": "ok"}
