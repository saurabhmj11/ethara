"""Application configuration."""
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    APP_NAME: str = "Ethara Seat Allocation & Project Mapping System"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # Database - default to SQLite for local dev; override with DATABASE_URL for Postgres
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./ethara.db"
    )

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "https://ethara-frontend.vercel.app",
        "*",
    ]

    # Seed data sizes
    SEED_EMPLOYEES: int = int(os.getenv("SEED_EMPLOYEES", "5000"))
    SEED_PROJECTS: int = int(os.getenv("SEED_PROJECTS", "60"))
    SEED_FLOORS: int = int(os.getenv("SEED_FLOORS", "4"))
    SEED_BAYS_PER_FLOOR: int = int(os.getenv("SEED_BAYS_PER_FLOOR", "8"))

    # AI Assistant
    ZAI_API_KEY: str = os.getenv("ZAI_API_KEY", "")

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
