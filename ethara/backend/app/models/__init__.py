"""SQLAlchemy ORM models."""
from __future__ import annotations
from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Float,
    UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class EmployeeStatus(str, PyEnum):
    ACTIVE = "ACTIVE"
    ONBOARDING = "ONBOARDING"  # New joiner, awaiting seat
    INACTIVE = "INACTIVE"


class SeatStatus(str, PyEnum):
    OCCUPIED = "OCCUPIED"
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"  # Reserved for a new joiner
    MAINTENANCE = "MAINTENANCE"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    manager_name = Column(String(150), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employees = relationship("Employee", back_populates="project")


class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # e.g. "Floor 1"
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bays = relationship("Bay", back_populates="floor", cascade="all, delete-orphan")


class Bay(Base):
    __tablename__ = "bays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, index=True)  # e.g. "Bay A"
    code = Column(String(20), nullable=False)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False, index=True)
    capacity = Column(Integer, nullable=False, default=20)
    created_at = Column(DateTime, default=datetime.utcnow)

    floor = relationship("Floor", back_populates="bays")
    seats = relationship("Seat", back_populates="bay", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("code", "floor_id", name="uq_bay_code_floor"),)


class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    seat_number = Column(String(20), nullable=False, index=True)  # e.g. "F1-A-001"
    bay_id = Column(Integer, ForeignKey("bays.id"), nullable=False, index=True)
    status = Column(String(20), default=SeatStatus.AVAILABLE.value, nullable=False, index=True)
    reserved_for_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bay = relationship("Bay", back_populates="seats")
    employee = relationship("Employee", foreign_keys=[reserved_for_employee_id])

    __table_args__ = (
        UniqueConstraint("seat_number", name="uq_seat_number"),
        Index("ix_seat_status_bay", "status", "bay_id"),
    )


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    emp_code = Column(String(20), unique=True, nullable=False, index=True)  # e.g. "ETH0001"
    full_name = Column(String(200), nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=True, index=True)
    designation = Column(String(150), nullable=True)
    status = Column(String(20), default=EmployeeStatus.ACTIVE.value, nullable=False, index=True)
    join_date = Column(Date, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=True, index=True, unique=True)
    manager_name = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="employees")
    seat = relationship("Seat", foreign_keys=[seat_id], post_update=True)

    __table_args__ = (
        Index("ix_employee_name_dept", "full_name", "department"),
    )


class ActivityLog(Base):
    """Audit log for seat allocation / release actions."""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), nullable=False)  # ALLOCATE / RELEASE / RESERVE / TRANSFER
    actor = Column(String(150), nullable=True)  # User who performed the action
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
