from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    secret_key: str = "CHANGE-ME"
    database_url: str = "sqlite:///./drainwatch.db"
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_mb: int = 8
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
