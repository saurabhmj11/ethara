"""Seat routes - allocation, release, reserve, listing."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services import crud
from app.schemas import (
    SeatCreate, SeatOut,
    SeatAllocationRequest, SeatReleaseRequest,
    SeatReserveRequest, NewJoinerAllocationRequest,
)

router = APIRouter(prefix="/seats", tags=["Seats"])


@router.get("", response_model=dict)
def list_seats(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    bay_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    items, total = crud.list_seats(
        db, skip=skip, limit=limit,
        bay_id=bay_id, floor_id=floor_id, status=status, search=search,
    )
    return {
        "items": [SeatOut.model_validate(s).model_dump() for s in items],
        "total": total,
        "page": skip // limit + 1 if limit else 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit if limit else 1,
    }


@router.get("/{seat_id}", response_model=SeatOut)
def get_seat(seat_id: int, db: Session = Depends(get_db)):
    seat = crud.get_seat(db, seat_id)
    if not seat:
        raise HTTPException(404, "Seat not found")
    return seat


@router.post("", response_model=SeatOut, status_code=201)
def create_seat(payload: SeatCreate, db: Session = Depends(get_db)):
    seat = SeatCreate.model_validate(payload)
    # use raw create via SQLAlchemy
    from app.models import Seat
    s = Seat(**seat.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.post("/allocate", response_model=dict)
def allocate_seat(payload: SeatAllocationRequest, db: Session = Depends(get_db)):
    success, msg, seat, emp = crud.allocate_seat(
        db, payload.employee_id, payload.seat_id, actor=payload.actor
    )
    if not success:
        raise HTTPException(400, msg)
    return {"success": True, "message": msg, "seat_id": seat.id if seat else None, "employee_id": emp.id if emp else None}


@router.post("/release", response_model=dict)
def release_seat(payload: SeatReleaseRequest, db: Session = Depends(get_db)):
    success, msg, seat = crud.release_seat(db, payload.seat_id, actor=payload.actor)
    if not success:
        raise HTTPException(400, msg)
    return {"success": True, "message": msg, "seat_id": seat.id if seat else None}


@router.post("/reserve", response_model=dict)
def reserve_seat(payload: SeatReserveRequest, db: Session = Depends(get_db)):
    success, msg, seat = crud.reserve_seat(
        db, payload.seat_id, payload.employee_id, actor=payload.actor
    )
    if not success:
        raise HTTPException(400, msg)
    return {"success": True, "message": msg, "seat_id": seat.id if seat else None}


@router.post("/allocate-new-joiner", response_model=dict)
def allocate_new_joiner(payload: NewJoinerAllocationRequest, db: Session = Depends(get_db)):
    success, msg, seat, emp = crud.allocate_new_joiner(
        db,
        payload.employee_id,
        preferred_floor_id=payload.preferred_floor_id,
        preferred_project_id=payload.preferred_project_id,
        actor=payload.actor,
    )
    if not success:
        raise HTTPException(400, msg)
    return {
        "success": True,
        "message": msg,
        "seat_id": seat.id if seat else None,
        "seat_number": seat.seat_number if seat else None,
        "employee_id": emp.id if emp else None,
        "employee_name": emp.full_name if emp else None,
    }
