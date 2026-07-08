"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi import BackgroundTasks

from app.core.config import settings
from app.core.database import Base, engine
from app.api import projects, floors, seats, employees, dashboard, ai_assistant


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (for dev). In production, use Alembic migrations.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Full-stack application that manages seat allocation and project mapping "
        "for ~5,000 employees. Includes AI Assistant for natural-language queries."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
app.include_router(floors.router, prefix=settings.API_V1_PREFIX)
app.include_router(seats.router, prefix=settings.API_V1_PREFIX)
app.include_router(employees.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai_assistant.router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "redoc": "/redoc",
        "api_prefix": settings.API_V1_PREFIX,
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}

@app.post("/api/seed-database", tags=["Admin"])
def seed_database_route(background_tasks: BackgroundTasks):
    def run_seed():
        from scripts.seed_db import reset_database, seed_projects, seed_floors_bays_seats, seed_employees, seed_activity_logs
        from app.core.database import SessionLocal
        
        reset_database()
        db = SessionLocal()
        try:
            n_emp = settings.SEED_EMPLOYEES
            n_proj = settings.SEED_PROJECTS
            n_floors = settings.SEED_FLOORS
            n_bays = settings.SEED_BAYS_PER_FLOOR
            n_seats = 26
            projects = seed_projects(db, n_proj)
            floors, bays, seats = seed_floors_bays_seats(db, n_floors, n_bays, n_seats)
            employees = seed_employees(db, projects, seats, n_emp)
            seed_activity_logs(db, employees, seats)
        finally:
            db.close()

    background_tasks.add_task(run_seed)
    return {"message": "Database seed started in the background! Please wait about 30-45 seconds for it to finish."}

