"""Seed data generation for the Ethara system.

Generates:
- 4 floors × 8 bays × ~25 seats each = ~800 seats (enough for 5000 employees to demo seat allocation; ratio can be tuned)
- 60 projects with realistic names, codes, and managers
- 5000 employees with names, emails, departments, designations, status
  - ~95% ACTIVE, ~5% ONBOARDING (new joiners without seat)
  - Active employees are assigned to a project and (most) to a seat
- A small percentage of seats left AVAILABLE for demo; some under MAINTENANCE
- Activity logs for sample allocations

Usage:
    python -m scripts.seed_db              # default sizes from config
    python -m scripts.seed_db --reset      # drop & recreate all tables
    python -m scripts.seed_db --small      # smaller dataset (1000 emp) for fast testing
"""
from __future__ import annotations
import argparse
import os
import random
import sys
from datetime import date, timedelta
from pathlib import Path

# Allow running as script from backend/ dir
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session
from faker import Faker

from app.core.database import SessionLocal, engine, Base
from app.models import (
    Project, Floor, Bay, Seat, Employee, ActivityLog,
    EmployeeStatus, SeatStatus,
)
from app.core.config import settings

fake = Faker()
Faker.seed(42)
random.seed(42)

DEPARTMENTS = [
    "Engineering", "Product", "Design", "QA", "DevOps",
    "Data Science", "Security", "HR", "Finance", "Marketing",
    "Sales", "Support", "Operations", "Legal",
]

DESIGNATIONS = [
    "Software Engineer", "Senior Software Engineer", "Staff Engineer",
    "Engineering Manager", "Tech Lead", "Architect",
    "Product Manager", "Senior Product Manager", "Designer",
    "QA Engineer", "DevOps Engineer", "Data Scientist",
    "Security Analyst", "HR Business Partner", "Financial Analyst",
    "Marketing Specialist", "Account Executive", "Support Engineer",
]

PROJECT_NAMES = [
    "Atlas", "Phoenix", "Orion", "Nova", "Pulse", "Quantum", "Horizon",
    "Zenith", "Vertex", "Apex", "Echo", "Vortex", "Stellar", "Cosmos",
    "Titan", "Ranger", "Falcon", "Vanguard", "Pioneer", "Summit",
    "Beacon", "Cipher", "Genesis", "Helix", "Nebula", "Pegasus",
    "QuantumLeap", "Radiant", "Spectra", "Tempest", "Umbra", "Voyager",
    "Whisper", "Xenon", "Yield", "ZenithPrime", "Aero", "Bolt",
    "Cobalt", "Drift", "Ember", "Forge", "Glide", "Halo", "Ignite",
    "Junction", "Kinetic", "Lumen", "Magnet", "Onyx", "Prism",
    "Quasar", "Ripple", "Stride", "Tide", "Unity", "Volt", "Wave",
    "Zephyr", "Compass",
]

PROJECT_DOMAINS = [
    "Platform", "Mobile", "Web", "API", "Cloud", "Data",
    "AI/ML", "Security", "Payments", "Growth", "Infra", "SDK",
]


def reset_database():
    """Drop and recreate all tables."""
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)


def seed_projects(db: Session, count: int) -> list[Project]:
    print(f"Seeding {count} projects...")
    projects = []
    used_codes = set()
    for i in range(count):
        name = PROJECT_NAMES[i % len(PROJECT_NAMES)]
        domain = PROJECT_DOMAINS[i % len(PROJECT_DOMAINS)]
        if i >= len(PROJECT_NAMES):
            name = f"{name} {i // len(PROJECT_NAMES) + 1}"
        # unique code: first 3 letters of name + domain prefix + number
        code_base = f"{name[:3].upper()}-{domain[:3].upper()}"
        code = code_base
        suffix = 1
        while code in used_codes:
            code = f"{code_base}-{suffix:02d}"
            suffix += 1
        used_codes.add(code)
        project = Project(
            name=name,
            code=code,
            description=f"{name} — {domain} initiative at Ethara.",
            manager_name=fake.name(),
            start_date=fake.date_between(start_date="-2y", end_date="-30d"),
            is_active=random.random() > 0.1,
        )
        db.add(project)
        projects.append(project)
    db.commit()
    for p in projects:
        db.refresh(p)
    print(f"  ✓ Created {len(projects)} projects")
    return projects


def seed_floors_bays_seats(db: Session, num_floors: int, bays_per_floor: int, seats_per_bay: int) -> tuple[list[Floor], list[Bay], list[Seat]]:
    print(f"Seeding {num_floors} floors × {bays_per_floor} bays × {seats_per_bay} seats...")
    floors, bays, seats = [], [], []
    bay_letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    for fi in range(num_floors):
        floor_name = f"Floor {fi + 1}"
        floor_code = f"F{fi + 1}"
        floor = Floor(name=floor_name, code=floor_code, description=f"{floor_name} of Ethara HQ")
        db.add(floor)
        db.commit()
        db.refresh(floor)
        floors.append(floor)
        for bi in range(bays_per_floor):
            bay_letter = bay_letters[bi % len(bay_letters)]
            bay_name = f"Bay {bay_letter}"
            bay_code = f"F{fi + 1}-{bay_letter}"
            bay = Bay(name=bay_name, code=bay_code, floor_id=floor.id, capacity=seats_per_bay)
            db.add(bay)
            db.commit()
            db.refresh(bay)
            bays.append(bay)
            for si in range(seats_per_bay):
                seat_number = f"F{fi + 1}-{bay_letter}-{si + 1:03d}"
                seat = Seat(seat_number=seat_number, bay_id=bay.id, status=SeatStatus.AVAILABLE.value)
                db.add(seat)
                seats.append(seat)
    db.commit()
    for s in seats:
        db.refresh(s)
    print(f"  ✓ Created {len(floors)} floors, {len(bays)} bays, {len(seats)} seats")
    return floors, bays, seats


def seed_employees(db: Session, projects: list[Project], seats: list[Seat], count: int) -> list[Employee]:
    print(f"Seeding {count} employees...")
    employees = []
    used_emails = set()
    # Decide how many are new joiners (~5%)
    n_new_joiners = int(count * 0.05)
    n_active = count - n_new_joiners

    # Pre-shuffle seats for allocation
    seat_pool = list(seats)
    random.shuffle(seat_pool)
    seat_idx = 0

    for i in range(count):
        full_name = fake.name()
        # unique email
        base = full_name.lower().replace(" ", ".")
        email = f"{base}@ethara.com"
        suffix = 1
        while email in used_emails:
            email = f"{base}{suffix}@ethara.com"
            suffix += 1
        used_emails.add(email)

        is_new_joiner = i < n_new_joiners
        status = EmployeeStatus.ONBOARDING.value if is_new_joiner else EmployeeStatus.ACTIVE.value
        project = random.choice(projects) if projects else None
        # Active employees get a seat only if there are seats left AND we haven't
        # filled past ~75% of seat capacity (leave some available for demo).
        seat_id = None
        max_occupy = int(len(seat_pool) * 0.75)
        if not is_new_joiner and seat_idx < max_occupy and random.random() < 0.85:
            seat = seat_pool[seat_idx]
            seat_idx += 1
            seat.status = SeatStatus.OCCUPIED.value
            seat_id = seat.id

        join_date = (
            fake.date_between(start_date="-30d", end_date="today")
            if is_new_joiner
            else fake.date_between(start_date="-3y", end_date="-30d")
        )
        emp = Employee(
            emp_code=f"ETH{i + 1:04d}",
            full_name=full_name,
            email=email,
            phone=fake.phone_number()[:20],
            department=random.choice(DEPARTMENTS),
            designation=random.choice(DESIGNATIONS),
            status=status,
            join_date=join_date,
            project_id=project.id if project else None,
            seat_id=seat_id,
            manager_name=fake.name(),
        )
        db.add(emp)
        employees.append(emp)
        if (i + 1) % 1000 == 0:
            print(f"    ... {i + 1} employees")
    db.commit()
    # Mark some remaining seats as maintenance
    for s in seat_pool[seat_idx:]:
        if random.random() < 0.03:
            s.status = SeatStatus.MAINTENANCE.value
    db.commit()
    print(f"  ✓ Created {len(employees)} employees ({n_new_joiners} new joiners, {n_active} active)")
    return employees


def seed_activity_logs(db: Session, employees: list[Employee], seats: list[Seat]):
    print("Seeding sample activity logs...")
    actions = ["ALLOCATE", "RELEASE", "RESERVE", "ALLOCATE", "ALLOCATE"]
    sample_size = min(50, len(employees))
    sample_emps = random.sample(employees, sample_size)
    for emp in sample_emps:
        action = random.choice(actions)
        seat = random.choice(seats)
        db.add(ActivityLog(
            action=action,
            actor=random.choice(["hr.admin@ethara.com", "ops.admin@ethara.com", "system"]),
            employee_id=emp.id,
            seat_id=seat.id,
            details=f"{action} — seat {seat.seat_number} ↔ {emp.full_name}",
        ))
    db.commit()
    print(f"  ✓ Created {sample_size} activity logs")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop & recreate tables")
    parser.add_argument("--small", action="store_true", help="Smaller dataset for fast testing")
    args = parser.parse_args()

    if args.reset:
        reset_database()
    else:
        Base.metadata.create_all(bind=engine)

    if args.small:
        n_emp, n_proj, n_floors, n_bays, n_seats = 1000, 15, 4, 8, 26
    else:
        n_emp = settings.SEED_EMPLOYEES
        n_proj = settings.SEED_PROJECTS
        n_floors = settings.SEED_FLOORS
        n_bays = settings.SEED_BAYS_PER_FLOOR
        # Each floor: 8 bays × 26 seats = 208 seats, × 4 floors = 832 seats
        n_seats = 26

    db = SessionLocal()
    try:
        # Check existing data
        existing = db.query(Employee).count()
        if existing > 0 and not args.reset:
            print(f"WARNING: {existing} employees already exist. Use --reset to recreate. Skipping seed.")
            return
        if args.reset:
            projects = seed_projects(db, n_proj)
            floors, bays, seats = seed_floors_bays_seats(db, n_floors, n_bays, n_seats)
            employees = seed_employees(db, projects, seats, n_emp)
            seed_activity_logs(db, employees, seats)
        print("\n=== Seed complete ===")
        stats = {
            "projects": db.query(Project).count(),
            "floors": db.query(Floor).count(),
            "bays": db.query(Bay).count(),
            "seats": db.query(Seat).count(),
            "employees": db.query(Employee).count(),
            "new_joiners": db.query(Employee).filter(Employee.status == EmployeeStatus.ONBOARDING.value).count(),
            "available_seats": db.query(Seat).filter(Seat.status == SeatStatus.AVAILABLE.value).count(),
            "occupied_seats": db.query(Seat).filter(Seat.status == SeatStatus.OCCUPIED.value).count(),
        }
        for k, v in stats.items():
            print(f"  {k:20s} {v}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
