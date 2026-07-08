"""Application configuration."""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load .env file from backend/ dir
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))


class Settings(BaseSettings):
    APP_NAME: str = "Ethara Seat Allocation & Project Mapping System"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # Database - default to SQLite for local dev; override with DATABASE_URL for Postgres
    DATABASE_URL: str = "sqlite:///./ethara.db"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "https://ethara-frontend.vercel.app",
        "*",
    ]

    # Seed data sizes
    SEED_EMPLOYEES: int = 5000
    SEED_PROJECTS: int = 60
    SEED_FLOORS: int = 4
    SEED_BAYS_PER_FLOOR: int = 8

    # AI Assistant
    ZAI_API_KEY: str = ""

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
