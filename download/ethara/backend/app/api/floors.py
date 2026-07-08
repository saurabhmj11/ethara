"""Floor & Bay routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services import crud
from app.schemas import FloorCreate, FloorOut, BayCreate, BayOut

router = APIRouter(prefix="/floors", tags=["Floors & Bays"])


@router.get("", response_model=list[FloorOut])
def list_floors(db: Session = Depends(get_db)):
    return crud.list_floors(db)


@router.post("", response_model=FloorOut, status_code=201)
def create_floor(payload: FloorCreate, db: Session = Depends(get_db)):
    return crud.create_floor(db, payload)


@router.get("/{floor_id}/bays", response_model=list[BayOut])
def list_bays_for_floor(floor_id: int, db: Session = Depends(get_db)):
    return crud.list_bays(db, floor_id=floor_id)


# Bays
@router.get("/bays/all", response_model=list[BayOut])
def list_all_bays(floor_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.list_bays(db, floor_id=floor_id)


@router.post("/bays", response_model=BayOut, status_code=201)
def create_bay(payload: BayCreate, db: Session = Depends(get_db)):
    return crud.create_bay(db, payload)
