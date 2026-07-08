"""Dashboard & analytics routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services import crud

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])


@router.get("/stats", response_model=dict)
def get_stats(db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db)


@router.get("/floor-utilization", response_model=list[dict])
def get_floor_utilization(db: Session = Depends(get_db)):
    return crud.get_floor_utilization(db)


@router.get("/project-distribution", response_model=list[dict])
def get_project_distribution(limit: int = 15, db: Session = Depends(get_db)):
    return crud.get_project_distribution(db, limit=limit)


@router.get("/department-distribution", response_model=list[dict])
def get_department_distribution(db: Session = Depends(get_db)):
    return crud.get_department_distribution(db)


@router.get("/activity-logs", response_model=dict)
def get_activity_logs(
    skip: int = 0,
    limit: int = 50,
    action: str = None,
    db: Session = Depends(get_db),
):
    items, total = crud.list_activity_logs(db, skip=skip, limit=limit, action=action)
    return {
        "items": [
            {
                "id": a.id, "action": a.action, "actor": a.actor,
                "employee_id": a.employee_id, "seat_id": a.seat_id,
                "details": a.details,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in items
        ],
        "total": total,
        "page": skip // limit + 1 if limit else 1,
        "page_size": limit,
    }
