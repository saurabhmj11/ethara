"""Project routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services import crud
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=dict)
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    items, total = crud.list_projects(db, skip=skip, limit=limit, search=search, is_active=is_active)
    return {
        "items": [ProjectOut.model_validate(p).model_dump() for p in items],
        "total": total,
        "page": skip // limit + 1 if limit else 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit if limit else 1,
    }


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = crud.get_project(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    if crud.get_project_by_code(db, payload.code):
        raise HTTPException(400, f"Project with code '{payload.code}' already exists")
    return crud.create_project(db, payload)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    p = crud.get_project(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return crud.update_project(db, p, payload)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = crud.get_project(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    crud.delete_project(db, p)
    return None
