"""Pydantic schemas for API request/response validation."""
from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- Project ----------
class ProjectBase(BaseModel):
    name: str = Field(..., max_length=150)
    code: str = Field(..., max_length=20)
    description: Optional[str] = None
    manager_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    manager_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    employee_count: Optional[int] = 0


# ---------- Floor ----------
class FloorBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class FloorCreate(FloorBase):
    pass


class FloorOut(FloorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    bay_count: Optional[int] = 0
    seat_count: Optional[int] = 0
    occupied_count: Optional[int] = 0


# ---------- Bay ----------
class BayBase(BaseModel):
    name: str
    code: str
    floor_id: int
    capacity: int = 20


class BayCreate(BayBase):
    pass


class BayOut(BayBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    floor_name: Optional[str] = None
    seat_count: Optional[int] = 0
    occupied_count: Optional[int] = 0


# ---------- Seat ----------
class SeatBase(BaseModel):
    seat_number: str
    bay_id: int
    status: str = "AVAILABLE"
    reserved_for_employee_id: Optional[int] = None


class SeatCreate(SeatBase):
    pass


class SeatOut(SeatBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    bay_name: Optional[str] = None
    floor_name: Optional[str] = None
    occupant_name: Optional[str] = None
    occupant_emp_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------- Employee ----------
class EmployeeBase(BaseModel):
    emp_code: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    status: str = "ACTIVE"
    join_date: Optional[date] = None
    project_id: Optional[int] = None
    seat_id: Optional[int] = None
    manager_name: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[int] = None
    seat_id: Optional[int] = None
    manager_name: Optional[str] = None


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    seat_number: Optional[str] = None
    bay_name: Optional[str] = None
    floor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------- Seat Allocation ----------
class SeatAllocationRequest(BaseModel):
    employee_id: int
    seat_id: int
    actor: Optional[str] = "system"


class SeatReleaseRequest(BaseModel):
    seat_id: int
    actor: Optional[str] = "system"


class SeatReserveRequest(BaseModel):
    """Reserve a seat for a new joiner."""
    seat_id: int
    employee_id: int
    actor: Optional[str] = "system"


class NewJoinerAllocationRequest(BaseModel):
    """Auto-allocate a seat for a new joiner."""
    employee_id: int
    preferred_floor_id: Optional[int] = None
    preferred_project_id: Optional[int] = None
    actor: Optional[str] = "system"


# ---------- Activity Log ----------
class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    action: str
    actor: Optional[str]
    employee_id: Optional[int]
    seat_id: Optional[int]
    details: Optional[str]
    created_at: datetime


# ---------- AI Assistant ----------
class AIQuery(BaseModel):
    query: str
    context_limit: int = 50


class AIResponse(BaseModel):
    query: str
    answer: str
    data: Optional[dict] = None
    sql: Optional[str] = None
    intent: Optional[str] = None
    elapsed_ms: int = 0
    llm_used: bool = False


# ---------- Dashboard ----------
class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    new_joiners: int
    total_seats: int
    occupied_seats: int
    available_seats: int
    reserved_seats: int
    maintenance_seats: int
    utilization_pct: float
    total_projects: int
    active_projects: int
    total_floors: int
    total_bays: int


class FloorUtilization(BaseModel):
    floor_name: str
    total: int
    occupied: int
    available: int
    utilization_pct: float


class ProjectDistribution(BaseModel):
    project_name: str
    project_code: str
    employee_count: int


class DepartmentDistribution(BaseModel):
    department: str
    employee_count: int


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int
