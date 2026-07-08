"""CRUD service layer for all entities."""
from __future__ import annotations
from typing import Optional, List, Any
from datetime import date
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Project, Floor, Bay, Seat, Employee, ActivityLog,
    EmployeeStatus, SeatStatus,
)
from app.schemas import (
    ProjectCreate, ProjectUpdate,
    FloorCreate, BayCreate,
    EmployeeCreate, EmployeeUpdate,
)


# ---------- Project CRUD ----------
def get_project(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


def get_project_by_code(db: Session, code: str) -> Optional[Project]:
    return db.query(Project).filter(Project.code == code).first()


def list_projects(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> tuple[list[Project], int]:
    q = db.query(Project)
    if search:
        q = q.filter(
            or_(
                Project.name.ilike(f"%{search}%"),
                Project.code.ilike(f"%{search}%"),
                Project.manager_name.ilike(f"%{search}%"),
            )
        )
    if is_active is not None:
        q = q.filter(Project.is_active == is_active)
    total = q.count()
    items = (
        q.order_by(Project.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    # Attach employee counts
    for p in items:
        p.employee_count = (
            db.query(func.count(Employee.id))
            .filter(Employee.project_id == p.id)
            .scalar()
            or 0
        )
    return items, total


def create_project(db: Session, payload: ProjectCreate) -> Project:
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project: Project, payload: ProjectUpdate) -> Project:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()


# ---------- Floor CRUD ----------
def list_floors(db: Session) -> list[Floor]:
    floors = db.query(Floor).order_by(Floor.name).all()
    for f in floors:
        bays = db.query(Bay).filter(Bay.floor_id == f.id).all()
        bay_ids = [b.id for b in bays]
        f.bay_count = len(bays)
        if bay_ids:
            f.seat_count = db.query(func.count(Seat.id)).filter(Seat.bay_id.in_(bay_ids)).scalar() or 0
            f.occupied_count = (
                db.query(func.count(Seat.id))
                .filter(Seat.bay_id.in_(bay_ids))
                .filter(Seat.status == SeatStatus.OCCUPIED.value)
                .scalar()
                or 0
            )
        else:
            f.seat_count = 0
            f.occupied_count = 0
    return floors


def create_floor(db: Session, payload: FloorCreate) -> Floor:
    floor = Floor(**payload.model_dump())
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


# ---------- Bay CRUD ----------
def list_bays(db: Session, floor_id: Optional[int] = None) -> list[Bay]:
    q = db.query(Bay)
    if floor_id:
        q = q.filter(Bay.floor_id == floor_id)
    bays = q.order_by(Bay.code).all()
    for b in bays:
        b.seat_count = db.query(func.count(Seat.id)).filter(Seat.bay_id == b.id).scalar() or 0
        b.occupied_count = (
            db.query(func.count(Seat.id))
            .filter(Seat.bay_id == b.id)
            .filter(Seat.status == SeatStatus.OCCUPIED.value)
            .scalar()
            or 0
        )
        floor = db.query(Floor).filter(Floor.id == b.floor_id).first()
        b.floor_name = floor.name if floor else None
    return bays


def create_bay(db: Session, payload: BayCreate) -> Bay:
    bay = Bay(**payload.model_dump())
    db.add(bay)
    db.commit()
    db.refresh(bay)
    return bay


# ---------- Seat CRUD ----------
def get_seat(db: Session, seat_id: int) -> Optional[Seat]:
    return db.query(Seat).filter(Seat.id == seat_id).first()


def list_seats(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    bay_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[list[Seat], int]:
    q = db.query(Seat)
    if bay_id:
        q = q.filter(Seat.bay_id == bay_id)
    if status:
        q = q.filter(Seat.status == status.upper())
    if floor_id:
        bay_ids = [b.id for b in db.query(Bay).filter(Bay.floor_id == floor_id).all()]
        q = q.filter(Seat.bay_id.in_(bay_ids))
    if search:
        q = q.filter(Seat.seat_number.ilike(f"%{search}%"))

    total = q.count()
    seats = q.offset(skip).limit(limit).all()
    # Enrich
    for s in seats:
        bay = db.query(Bay).filter(Bay.id == s.bay_id).first()
        if bay:
            s.bay_name = bay.name
            floor = db.query(Floor).filter(Floor.id == bay.floor_id).first()
            s.floor_name = floor.name if floor else None
        if s.status == SeatStatus.OCCUPIED.value:
            emp = db.query(Employee).filter(Employee.seat_id == s.id).first()
            if emp:
                s.occupant_name = emp.full_name
                s.occupant_emp_code = emp.emp_code
        elif s.status == SeatStatus.RESERVED.value and s.reserved_for_employee_id:
            emp = db.query(Employee).filter(Employee.id == s.reserved_for_employee_id).first()
            if emp:
                s.occupant_name = f"(Reserved) {emp.full_name}"
                s.occupant_emp_code = emp.emp_code
    return seats, total


def allocate_seat(db: Session, employee_id: int, seat_id: int, actor: str = "system") -> tuple[bool, str, Optional[Seat], Optional[Employee]]:
    """Allocate a seat to an employee. Returns (success, message, seat, employee)."""
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        return False, "Seat not found", None, None
    if seat.status == SeatStatus.OCCUPIED.value:
        return False, f"Seat {seat.seat_number} is already occupied", seat, None
    if seat.status == SeatStatus.MAINTENANCE.value:
        return False, f"Seat {seat.seat_number} is under maintenance", seat, None

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return False, "Employee not found", seat, None

    # Release employee's existing seat if any
    if employee.seat_id:
        old_seat = db.query(Seat).filter(Seat.id == employee.seat_id).first()
        if old_seat:
            old_seat.status = SeatStatus.AVAILABLE.value
            old_seat.reserved_for_employee_id = None

    seat.status = SeatStatus.OCCUPIED.value
    seat.reserved_for_employee_id = None
    employee.seat_id = seat.id
    if employee.status == EmployeeStatus.ONBOARDING.value:
        employee.status = EmployeeStatus.ACTIVE.value
    db.commit()
    db.refresh(seat)
    db.refresh(employee)

    log = ActivityLog(
        action="ALLOCATE",
        actor=actor,
        employee_id=employee.id,
        seat_id=seat.id,
        details=f"Allocated seat {seat.seat_number} to {employee.full_name} ({employee.emp_code})",
    )
    db.add(log)
    db.commit()
    return True, f"Seat {seat.seat_number} allocated to {employee.full_name}", seat, employee


def release_seat(db: Session, seat_id: int, actor: str = "system") -> tuple[bool, str, Optional[Seat]]:
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        return False, "Seat not found", None
    if seat.status != SeatStatus.OCCUPIED.value:
        return False, f"Seat {seat.seat_number} is not occupied", seat

    emp = db.query(Employee).filter(Employee.seat_id == seat.id).first()
    emp_name = emp.full_name if emp else "unknown"
    if emp:
        emp.seat_id = None

    seat.status = SeatStatus.AVAILABLE.value
    seat.reserved_for_employee_id = None
    db.commit()
    db.refresh(seat)

    db.add(ActivityLog(
        action="RELEASE",
        actor=actor,
        employee_id=emp.id if emp else None,
        seat_id=seat.id,
        details=f"Released seat {seat.seat_number} from {emp_name}",
    ))
    db.commit()
    return True, f"Seat {seat.seat_number} released from {emp_name}", seat


def reserve_seat(db: Session, seat_id: int, employee_id: int, actor: str = "system") -> tuple[bool, str, Optional[Seat]]:
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        return False, "Seat not found", None
    if seat.status != SeatStatus.AVAILABLE.value:
        return False, f"Seat {seat.seat_number} is not available to reserve (status={seat.status})", seat

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return False, "Employee not found", seat, None

    seat.status = SeatStatus.RESERVED.value
    seat.reserved_for_employee_id = employee.id
    db.commit()
    db.refresh(seat)

    db.add(ActivityLog(
        action="RESERVE",
        actor=actor,
        employee_id=employee.id,
        seat_id=seat.id,
        details=f"Reserved seat {seat.seat_number} for new joiner {employee.full_name}",
    ))
    db.commit()
    return True, f"Seat {seat.seat_number} reserved for {employee.full_name}", seat


def allocate_new_joiner(
    db: Session,
    employee_id: int,
    preferred_floor_id: Optional[int] = None,
    preferred_project_id: Optional[int] = None,
    actor: str = "system",
) -> tuple[bool, str, Optional[Seat], Optional[Employee]]:
    """Auto-allocate an available seat to a new joiner.
    Strategy:
      - If preferred_floor_id is given, search that floor first.
      - Try to cluster employees of the same project on the same floor/bay.
      - Pick the first AVAILABLE seat.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return False, "Employee not found", None, None
    if employee.status != EmployeeStatus.ONBOARDING.value:
        return False, f"Employee {employee.full_name} is not a new joiner (status={employee.status})", None, employee
    if employee.seat_id:
        seat = db.query(Seat).filter(Seat.id == employee.seat_id).first()
        return False, f"Employee {employee.full_name} already has seat {seat.seat_number if seat else 'unknown'}", seat, employee

    # Find candidate seats
    candidate_seats = db.query(Seat).filter(Seat.status == SeatStatus.AVAILABLE.value)

    # 1) Try same-bay cluster for project members
    project_id_to_use = preferred_project_id or employee.project_id
    if project_id_to_use:
        same_project_emp = (
            db.query(Employee)
            .filter(Employee.project_id == project_id_to_use)
            .filter(Employee.seat_id.isnot(None))
            .all()
        )
        if same_project_emp:
            seat_ids = [e.seat_id for e in same_project_emp]
            same_bay_seats = (
                db.query(Seat)
                .filter(Seat.id.in_(seat_ids))
                .all()
            )
            bay_ids = list({s.bay_id for s in same_bay_seats})
            if bay_ids:
                clustered = candidate_seats.filter(Seat.bay_id.in_(bay_ids)).first()
                if clustered:
                    return allocate_seat(db, employee.id, clustered.id, actor=actor)

    # 2) Preferred floor
    if preferred_floor_id:
        bay_ids = [b.id for b in db.query(Bay).filter(Bay.floor_id == preferred_floor_id).all()]
        if bay_ids:
            seat = candidate_seats.filter(Seat.bay_id.in_(bay_ids)).first()
            if seat:
                return allocate_seat(db, employee.id, seat.id, actor=actor)

    # 3) Any available seat
    seat = candidate_seats.first()
    if not seat:
        return False, "No available seats", None, employee
    return allocate_seat(db, employee.id, seat.id, actor=actor)


# ---------- Employee CRUD ----------
def get_employee(db: Session, employee_id: int) -> Optional[Employee]:
    return db.query(Employee).filter(Employee.id == employee_id).first()


def list_employees(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    bay_id: Optional[int] = None,
    has_seat: Optional[bool] = None,
) -> tuple[list[Employee], int]:
    q = db.query(Employee)
    if search:
        q = q.filter(
            or_(
                Employee.full_name.ilike(f"%{search}%"),
                Employee.email.ilike(f"%{search}%"),
                Employee.emp_code.ilike(f"%{search}%"),
                Employee.designation.ilike(f"%{search}%"),
            )
        )
    if department:
        q = q.filter(Employee.department == department)
    if status:
        q = q.filter(Employee.status == status.upper())
    if project_id:
        q = q.filter(Employee.project_id == project_id)
    if bay_id:
        seat_ids = [s.id for s in db.query(Seat).filter(Seat.bay_id == bay_id).all()]
        q = q.filter(Employee.seat_id.in_(seat_ids))
    elif floor_id:
        bay_ids = [b.id for b in db.query(Bay).filter(Bay.floor_id == floor_id).all()]
        seat_ids = [s.id for s in db.query(Seat).filter(Seat.bay_id.in_(bay_ids)).all()]
        q = q.filter(Employee.seat_id.in_(seat_ids))
    if has_seat is True:
        q = q.filter(Employee.seat_id.isnot(None))
    elif has_seat is False:
        q = q.filter(Employee.seat_id.is_(None))

    total = q.count()
    employees = q.order_by(Employee.id.desc()).offset(skip).limit(limit).all()
    for e in employees:
        if e.project_id:
            p = db.query(Project).filter(Project.id == e.project_id).first()
            if p:
                e.project_name = p.name
                e.project_code = p.code
        if e.seat_id:
            s = db.query(Seat).filter(Seat.id == e.seat_id).first()
            if s:
                e.seat_number = s.seat_number
                b = db.query(Bay).filter(Bay.id == s.bay_id).first()
                if b:
                    e.bay_name = b.name
                    f = db.query(Floor).filter(Floor.id == b.floor_id).first()
                    if f:
                        e.floor_name = f.name
    return employees, total


def create_employee(db: Session, payload: EmployeeCreate) -> Employee:
    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


def update_employee(db: Session, employee: Employee, payload: EmployeeUpdate) -> Employee:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(employee, k, v)
    db.commit()
    db.refresh(employee)
    return employee


def delete_employee(db: Session, employee: Employee) -> None:
    # Release the seat
    if employee.seat_id:
        seat = db.query(Seat).filter(Seat.id == employee.seat_id).first()
        if seat:
            seat.status = SeatStatus.AVAILABLE.value
            seat.reserved_for_employee_id = None
    db.delete(employee)
    db.commit()


# ---------- Activity Log ----------
def list_activity_logs(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    action: Optional[str] = None,
) -> tuple[list[ActivityLog], int]:
    q = db.query(ActivityLog)
    if action:
        q = q.filter(ActivityLog.action == action.upper())
    total = q.count()
    items = q.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


# ---------- Dashboard / Analytics ----------
def get_dashboard_stats(db: Session) -> dict:
    total_employees = db.query(func.count(Employee.id)).scalar() or 0
    active_employees = (
        db.query(func.count(Employee.id))
        .filter(Employee.status == EmployeeStatus.ACTIVE.value)
        .scalar()
        or 0
    )
    new_joiners = (
        db.query(func.count(Employee.id))
        .filter(Employee.status == EmployeeStatus.ONBOARDING.value)
        .scalar()
        or 0
    )
    total_seats = db.query(func.count(Seat.id)).scalar() or 0
    occupied_seats = (
        db.query(func.count(Seat.id))
        .filter(Seat.status == SeatStatus.OCCUPIED.value)
        .scalar()
        or 0
    )
    available_seats = (
        db.query(func.count(Seat.id))
        .filter(Seat.status == SeatStatus.AVAILABLE.value)
        .scalar()
        or 0
    )
    reserved_seats = (
        db.query(func.count(Seat.id))
        .filter(Seat.status == SeatStatus.RESERVED.value)
        .scalar()
        or 0
    )
    maintenance_seats = (
        db.query(func.count(Seat.id))
        .filter(Seat.status == SeatStatus.MAINTENANCE.value)
        .scalar()
        or 0
    )
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    active_projects = (
        db.query(func.count(Project.id)).filter(Project.is_active.is_(True)).scalar() or 0
    )
    total_floors = db.query(func.count(Floor.id)).scalar() or 0
    total_bays = db.query(func.count(Bay.id)).scalar() or 0

    utilization = (
        round((occupied_seats / total_seats) * 100, 2) if total_seats else 0.0
    )

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "new_joiners": new_joiners,
        "total_seats": total_seats,
        "occupied_seats": occupied_seats,
        "available_seats": available_seats,
        "reserved_seats": reserved_seats,
        "maintenance_seats": maintenance_seats,
        "utilization_pct": utilization,
        "total_projects": total_projects,
        "active_projects": active_projects,
        "total_floors": total_floors,
        "total_bays": total_bays,
    }


def get_floor_utilization(db: Session) -> list[dict]:
    floors = db.query(Floor).order_by(Floor.name).all()
    result = []
    for f in floors:
        bays = db.query(Bay).filter(Bay.floor_id == f.id).all()
        bay_ids = [b.id for b in bays]
        if not bay_ids:
            result.append({
                "floor_name": f.name, "total": 0, "occupied": 0,
                "available": 0, "utilization_pct": 0.0,
            })
            continue
        total = db.query(func.count(Seat.id)).filter(Seat.bay_id.in_(bay_ids)).scalar() or 0
        occupied = (
            db.query(func.count(Seat.id))
            .filter(Seat.bay_id.in_(bay_ids))
            .filter(Seat.status == SeatStatus.OCCUPIED.value)
            .scalar()
            or 0
        )
        available = total - occupied
        utilization = round((occupied / total) * 100, 2) if total else 0.0
        result.append({
            "floor_name": f.name,
            "total": total,
            "occupied": occupied,
            "available": available,
            "utilization_pct": utilization,
        })
    return result


def get_project_distribution(db: Session, limit: int = 15) -> list[dict]:
    rows = (
        db.query(
            Project.name,
            Project.code,
            func.count(Employee.id).label("emp_count"),
        )
        .outerjoin(Employee, Employee.project_id == Project.id)
        .group_by(Project.id)
        .order_by(func.count(Employee.id).desc())
        .limit(limit)
        .all()
    )
    return [
        {"project_name": r[0], "project_code": r[1], "employee_count": r[2]}
        for r in rows
    ]


def get_department_distribution(db: Session) -> list[dict]:
    rows = (
        db.query(Employee.department, func.count(Employee.id))
        .filter(Employee.department.isnot(None))
        .group_by(Employee.department)
        .order_by(func.count(Employee.id).desc())
        .all()
    )
    return [{"department": r[0] or "Unassigned", "employee_count": r[1]} for r in rows]
