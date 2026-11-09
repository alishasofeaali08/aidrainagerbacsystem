from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    secret_key: str = "CHANGE-ME"
    database_url: str = "sqlite:///./drainwatch.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    upload_dir: str = "uploads"
    max_upload_mb: int = 8
    accuweather_api_key: str = ""
    metmalaysia_api_token: str = ""
    weatherapi_key: str = ""
    preferred_weather_provider: str = "openmeteo"  # metmalaysia, accuweather, weatherapi, openmeteo
    osrm_api_url: str = "https://router.project-osrm.org"  # OSRM routing API
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
