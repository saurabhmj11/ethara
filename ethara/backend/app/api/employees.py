"""Employee routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services import crud
from app.schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=dict)
def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    bay_id: Optional[int] = None,
    has_seat: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    items, total = crud.list_employees(
        db, skip=skip, limit=limit,
        search=search, department=department, status=status,
        project_id=project_id, floor_id=floor_id, bay_id=bay_id,
        has_seat=has_seat,
    )
    return {
        "items": [EmployeeOut.model_validate(e).model_dump() for e in items],
        "total": total,
        "page": skip // limit + 1 if limit else 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit if limit else 1,
    }


@router.get("/departments", response_model=list[str])
def list_departments(db: Session = Depends(get_db)):
    from sqlalchemy import distinct
    from app.models import Employee
    rows = db.query(distinct(Employee.department)).filter(Employee.department.isnot(None)).all()
    return [r[0] for r in rows]


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    e = crud.get_employee(db, employee_id)
    if not e:
        raise HTTPException(404, "Employee not found")
    return e


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    return crud.create_employee(db, payload)


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    e = crud.get_employee(db, employee_id)
    if not e:
        raise HTTPException(404, "Employee not found")
    return crud.update_employee(db, e, payload)


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    e = crud.get_employee(db, employee_id)
    if not e:
        raise HTTPException(404, "Employee not found")
    crud.delete_employee(db, e)
    return None
