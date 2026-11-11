from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from HISAAB_* environment variables, or a .env file in the backend folder."""

    model_config = SettingsConfigDict(env_prefix="HISAAB_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./hisaab.db"
    session_days: int = 30
    cookie_name: str = "hisaab_session"
    cookie_secure: bool = False
