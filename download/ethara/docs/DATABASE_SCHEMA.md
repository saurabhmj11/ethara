# Database Schema

This document describes the database schema for the Ethara Seat Allocation & Project Mapping System.

## Overview

The schema consists of 6 tables that model the physical office layout (floors → bays → seats) and the people dimension (employees → projects), connected through seat allocation. An audit log table tracks all seat allocation/release actions.

## ER Diagram (textual)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   floors    │ 1     n │    bays     │ 1     n │    seats    │
│─────────────│─────────│─────────────│─────────│─────────────│
│ id (PK)     │         │ id (PK)     │         │ id (PK)     │
│ name        │         │ name        │         │ seat_number │
│ code (UQ)   │         │ code        │         │ bay_id (FK) │
│ description │         │ floor_id FK │         │ status      │
│ created_at  │         │ capacity    │         │ reserved_for│
└─────────────┘         │ created_at  │         │  _employee  │
                        └─────────────┘         │ created_at  │
                                                │ updated_at  │
                                                └──────┬──────┘
                                                       │ 1
                                                       │
                                                       │ 1
┌─────────────┐         ┌─────────────┐         ┌──────┴──────┐
│  projects   │ 1     n │ employees   │ 1     1 │   seats     │
│─────────────│─────────│─────────────│─────────│ (already    │
│ id (PK)     │         │ id (PK)     │         │  shown)     │
│ name (UQ)   │         │ emp_code UQ │         └─────────────┘
│ code (UQ)   │         │ full_name   │
│ description │         │ email (UQ)  │
│ manager_name│         │ phone       │
│ start_date  │         │ department  │
│ end_date    │         │ designation │
│ is_active   │         │ status      │
│ created_at  │         │ join_date   │
│ updated_at  │         │ project_id  │
└─────────────┘         │ seat_id (UQ)│
                        │ manager_name│
                        │ created_at  │
                        │ updated_at  │
                        └─────────────┘

┌──────────────────┐
│  activity_logs   │
│──────────────────│
│ id (PK)          │
│ action           │
│ actor            │
│ employee_id (FK) │
│ seat_id (FK)     │
│ details          │
│ created_at       │
└──────────────────┘
```

## Tables

### `projects`
Stores project/team information for mapping employees.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | PK, auto-increment | |
| `name` | String(150) | UNIQUE, NOT NULL, indexed | Project display name |
| `code` | String(20) | UNIQUE, NOT NULL, indexed | Short code, e.g. `ATL-PLA` |
| `description` | Text | nullable | |
| `manager_name` | String(150) | nullable | |
| `start_date` | Date | nullable | |
| `end_date` | Date | nullable | |
| `is_active` | Boolean | NOT NULL, default `true` | |
| `created_at` | DateTime | default now | |
| `updated_at` | DateTime | default now, on update now | |

### `floors`
Top-level physical location.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK |
| `name` | String(50) | UNIQUE, NOT NULL, indexed |
| `code` | String(20) | UNIQUE, NOT NULL |
| `description` | Text | nullable |
| `created_at` | DateTime | default now |

### `bays`
Grouping of seats within a floor.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK |
| `name` | String(50) | NOT NULL, indexed |
| `code` | String(20) | NOT NULL |
| `floor_id` | Integer | FK → `floors.id`, NOT NULL, indexed |
| `capacity` | Integer | NOT NULL, default 20 |
| `created_at` | DateTime | default now |

**Composite unique constraint:** `(code, floor_id)` — same bay code can exist on different floors.

### `seats`
Individual seat/workstation.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK |
| `seat_number` | String(20) | UNIQUE, NOT NULL, indexed — format: `F1-A-001` |
| `bay_id` | Integer | FK → `bays.id`, NOT NULL, indexed |
| `status` | String(20) | NOT NULL, default `AVAILABLE`, indexed — one of `AVAILABLE`, `OCCUPIED`, `RESERVED`, `MAINTENANCE` |
| `reserved_for_employee_id` | Integer | FK → `employees.id`, nullable — set when status is RESERVED |
| `created_at` | DateTime | default now |
| `updated_at` | DateTime | default now, on update now |

**Composite index:** `(status, bay_id)` — for the common query "available seats in bay X".

### `employees`
The main person entity. 5,000 rows in seed data.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK |
| `emp_code` | String(20) | UNIQUE, NOT NULL, indexed — format: `ETH0001` |
| `full_name` | String(200) | NOT NULL, indexed |
| `email` | String(150) | UNIQUE, NOT NULL, indexed |
| `phone` | String(20) | nullable |
| `department` | String(100) | nullable, indexed |
| `designation` | String(150) | nullable |
| `status` | String(20) | NOT NULL, default `ACTIVE`, indexed — one of `ACTIVE`, `ONBOARDING`, `INACTIVE` |
| `join_date` | Date | nullable |
| `project_id` | Integer | FK → `projects.id`, nullable, indexed |
| `seat_id` | Integer | FK → `seats.id`, nullable, indexed, UNIQUE — one-to-one |
| `manager_name` | String(150) | nullable |
| `created_at` | DateTime | default now |
| `updated_at` | DateTime | default now, on update now |

**Composite index:** `(full_name, department)` — for the employee search query.

### `activity_logs`
Audit trail of seat allocation/release/reserve actions.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK |
| `action` | String(50) | NOT NULL — `ALLOCATE`, `RELEASE`, `RESERVE`, `TRANSFER` |
| `actor` | String(150) | nullable — user who performed the action |
| `employee_id` | Integer | FK → `employees.id`, nullable |
| `seat_id` | Integer | FK → `seats.id`, nullable |
| `details` | Text | nullable — human-readable description |
| `created_at` | DateTime | default now, indexed |

## Business Rules Enforced

1. **One employee → one seat:** `employees.seat_id` has a UNIQUE constraint.
2. **Seat status consistency:** When a seat is `OCCUPIED`, the assigned employee's `seat_id` points to it. When `AVAILABLE`, no employee should reference it.
3. **New joiner status:** Employees with status `ONBOARDING` typically have `seat_id = NULL`. Allocating a seat to them promotes status to `ACTIVE` (handled in `crud.allocate_seat()`).
4. **Seat reservation:** A seat can be `RESERVED` for a specific new joiner via `reserved_for_employee_id`. The seat is not yet `OCCUPIED` — it's a soft hold.
5. **Maintenance seats:** Cannot be allocated (handled in `crud.allocate_seat()`).
6. **Cascade deletes:** Deleting a floor cascades to its bays and their seats. Deleting a project does NOT cascade to employees (their `project_id` becomes NULL). Deleting an employee releases their seat (handled in `crud.delete_employee()`).

## Seed Data Volumes

| Table | Count |
|-------|-------|
| `floors` | 4 |
| `bays` | 32 (8 per floor) |
| `seats` | 832 (26 per bay) |
| `projects` | 60 |
| `employees` | 5,000 (4,750 ACTIVE + 250 ONBOARDING) |
| `activity_logs` | 50 sample entries |

**Seat status distribution after seed:**
- `OCCUPIED`: 624 (75%)
- `AVAILABLE`: 204 (24.5%)
- `MAINTENANCE`: 4 (0.5%)
- `RESERVED`: 0 (created dynamically when a new joiner reserves a seat)

## Migration Strategy

For production, use Alembic migrations instead of `Base.metadata.create_all()`:

```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

For local development, the application auto-creates tables on startup via the `lifespan` context manager in `app/main.py`.
