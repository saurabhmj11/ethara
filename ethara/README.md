# Ethara — Seat Allocation & Project Mapping System

A full-stack application that manages seat allocation and project mapping for ~5,000 employees. Built for the **Ethara Software Engineer technical assessment**.

> **Live Demo:** Frontend → _add your Vercel URL_  •  Backend → _add your Render/Railway URL_  •  Swagger → _add backend URL_`/docs`

---

## ✨ Features

| # | Feature | Status |
|---|---------|--------|
| 1 | **Employee Management** — CRUD for 5,000 employees with department, designation, project, status | ✅ |
| 2 | **Project Mapping** — 60 projects with codes, managers, active/inactive flags, employee counts | ✅ |
| 3 | **Seat Allocation & Release** — Visual floor/bay/seat grid; one-click allocate or release | ✅ |
| 4 | **New Joiner Seat Allocation** — Auto-allocate with project-clustering strategy; bulk-allocate button | ✅ |
| 5 | **Search & Filter** — Filter employees by name/email/code, status, department, project, floor, seat status | ✅ |
| 6 | **Dashboard & Analytics** — KPIs, floor utilization, project distribution, department breakdown, activity log | ✅ |
| 7 | **AI Assistant** — Natural-language queries powered by z-ai-web-dev-sdk LLM with rule-based intent routing | ✅ |
| 8 | **REST APIs** — FastAPI with full Swagger/OpenAPI docs at `/docs` | ✅ |
| 9 | **Seed Data Generation** — 5,000 employees, 60 projects, 4 floors × 8 bays × 26 seats = 832 seats | ✅ |

---

## 🧱 Tech Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Recharts
- **Backend:** FastAPI 0.115 + SQLAlchemy 2 + Pydantic v2 + Uvicorn
- **Database:** PostgreSQL (production) / SQLite (local dev) — switchable via `DATABASE_URL`
- **AI Assistant:** z-ai-web-dev-sdk (called via `z-ai` CLI subprocess from Python)
- **Seed data:** Faker
- **Deployment targets:** Vercel (frontend), Render/Railway (backend), any Postgres host

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.11+ and `pip`
- Node.js 18+ and `npm`
- (Optional) PostgreSQL 14+ if you want to use Postgres instead of SQLite

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # edit if using PostgreSQL

# Seed the database (5,000 employees, ~30s)
python -m scripts.seed_db --reset

# Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API now available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health check:** http://localhost:8000/health

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend now available at http://localhost:3000

The frontend uses **relative URLs** (`/api/v1/...`) which are proxied to the
backend via `next.config.ts` rewrites. This avoids CORS issues and works in
preview environments where the backend port isn't directly exposed to the
browser. The proxy destination is controlled by the `BACKEND_URL` env var
(defaults to `http://localhost:8000`).

### 3. Or use the launcher script

```bash
bash start.sh
```

This starts both servers in the background and prints their URLs.

---

## 📂 Project Structure

```
ethara/
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI routers
│   │   │   ├── projects.py
│   │   │   ├── employees.py
│   │   │   ├── seats.py
│   │   │   ├── floors.py
│   │   │   ├── dashboard.py
│   │   │   └── ai_assistant.py
│   │   ├── core/               # config + database
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # CRUD + AI assistant business logic
│   │   └── main.py             # FastAPI app entry
│   ├── scripts/
│   │   ├── seed_db.py          # Seed data generation
│   │   └── test_endpoints.py   # Smoke tests for all endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── page.tsx                  # Dashboard
│   │   │   ├── employees/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── seats/page.tsx            # Seat map
│   │   │   ├── new-joiners/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   └── ai-assistant/page.tsx
│   │   ├── components/         # Sidebar, StatCard
│   │   ├── lib/                # API client, utils
│   │   └── types/              # TypeScript types matching backend schemas
│   └── package.json
├── docs/                       # Schema, deployment, debug notes
├── screenshots/                # UI screenshots
├── AI_PROMPTS.md               # AI usage documentation
├── README.md                   # This file
└── start.sh                    # One-shot launcher
```

---

## 🗄️ Database Schema

See [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) for the full schema with relationships.

**Entities:** `projects`, `floors`, `bays`, `seats`, `employees`, `activity_logs`

**Key relationships:**
- `Employee.project_id → Project.id` (many-to-one)
- `Employee.seat_id → Seat.id` (one-to-one, unique)
- `Seat.bay_id → Bay.id` (many-to-one)
- `Bay.floor_id → Floor.id` (many-to-one)
- `Seat.reserved_for_employee_id → Employee.id` (for new-joiner reservations)

---

## 🔌 API Overview

All endpoints are prefixed with `/api/v1`. Full Swagger docs at `/docs`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/stats` | Aggregate KPI stats |
| GET | `/dashboard/floor-utilization` | Floor-wise seat utilization |
| GET | `/dashboard/project-distribution` | Top projects by employee count |
| GET | `/dashboard/department-distribution` | Headcount by department |
| GET | `/dashboard/activity-logs` | Audit trail |
| GET | `/employees` | List/search/filter employees (paginated) |
| POST | `/employees` | Create employee |
| GET | `/employees/{id}` | Get employee |
| PUT | `/employees/{id}` | Update employee |
| DELETE | `/employees/{id}` | Delete employee (releases their seat) |
| GET | `/projects` | List/search projects (paginated) |
| POST/PUT/DELETE | `/projects[/{id}]` | Project CRUD |
| GET | `/floors` | List floors with seat counts |
| GET | `/floors/bays/all` | List all bays (optional `?floor_id=`) |
| GET | `/seats` | List/search/filter seats (paginated) |
| POST | `/seats/allocate` | Allocate a seat to an employee |
| POST | `/seats/release` | Release an occupied seat |
| POST | `/seats/reserve` | Reserve a seat for a new joiner |
| POST | `/seats/allocate-new-joiner` | Auto-allocate a seat to a new joiner |
| POST | `/ai/query` | Ask the AI Assistant a natural-language question |
| GET | `/ai/suggestions` | Sample queries to try |

---

## 🤖 AI Assistant

The AI Assistant uses a **hybrid architecture**:

1. **Rule-based intent detection** — regex patterns classify the query into one of 9 intents (available_seats, occupied_seats, new_joiners, floor_utilization, project_employees, employee_seat, project_distribution, department_distribution, total_stats).
2. **Data fetching** — based on the intent, the appropriate SQLAlchemy query runs against the DB and returns structured data.
3. **LLM natural-language generation** — the structured data is passed to the **z-ai-web-dev-sdk** LLM (via the `z-ai` CLI subprocess from Python) along with a system prompt that instructs it to write a concise, friendly natural-language answer.

This hybrid approach is more reliable than pure text-to-SQL: the rule-based layer guarantees correct data fetching, while the LLM provides fluent natural-language responses.

**Sample queries:**
- "How many available seats are there on Floor 2?"
- "Show me all new joiners without a seat"
- "What is the floor-wise utilization?"
- "How many employees are in project Atlas?"
- "Where does employee ETH0001 sit?"

---

## 📊 Seed Data

The seed script generates a realistic dataset:

| Entity | Count |
|--------|-------|
| Floors | 4 |
| Bays | 32 (8 per floor) |
| Seats | 832 (26 per bay) |
| Projects | 60 |
| Employees | 5,000 |
| - Active | 4,750 |
| - New joiners (ONBOARDING) | 250 |
| - With seat | ~624 (75% seat utilization) |
| - Without seat (active) | ~4,126 (remote/hot-desk) |
| Activity logs | 50 sample entries |

To re-seed: `python -m scripts.seed_db --reset`
For a smaller dataset (1,000 employees): `python -m scripts.seed_db --reset --small`

---

## 🚢 Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full deployment instructions for:
- **Frontend** → Vercel
- **Backend** → Render or Railway
- **Database** → Render Postgres, Railway Postgres, or Supabase

---

## 🧪 Testing

Run the backend smoke tests:

```bash
cd backend
source venv/bin/activate
python scripts/test_endpoints.py
```

This hits every endpoint with sample requests and verifies responses.

---

## 📝 Documentation

- [`AI_PROMPTS.md`](AI_PROMPTS.md) — AI usage documentation (required by assessment)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — Schema with ER diagram
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Deployment guides for Vercel + Render
- [`docs/DEBUGGING_NOTES.md`](docs/DEBUGGING_NOTES.md) — Issues encountered & resolutions
- [`screenshots/`](screenshots/) — UI screenshots of all pages

---

## 📜 License

Built as a technical assessment submission for Ethara.
