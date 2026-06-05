from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    allowed_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
