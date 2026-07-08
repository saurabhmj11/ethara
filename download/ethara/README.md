# Ethara — Seat Allocation & Project Mapping System

A full-stack application that manages seat allocation and project mapping for ~5,000 employees. Built for the **Ethara Software Engineer technical assessment**.

> **Live Demo:** _Add your URLs after deployment (see "Deployment" below)_

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=YOUR_GITHUB_URL&root-directory=frontend&env=BACKEND_URL&envDescription=URL%20of%20your%20deployed%20FastAPI%20backend)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## ✨ Features

| # | Requirement | Status |
|---|---------|--------|
| 1 | **Employee Management** — CRUD for 5,000 employees with department, designation, project, status | ✅ |
| 2 | **Project Mapping** — 60 projects with codes, managers, active/inactive flags, employee counts | ✅ |
| 3 | **Seat Allocation & Release** — Visual floor/bay/seat grid; one-click allocate or release | ✅ |
| 4 | **New Joiner Seat Allocation** — Auto-allocate with project-clustering strategy; bulk-allocate button | ✅ |
| 5 | **Search & Filter** — Filter employees by name/email/code, status, department, project, floor, seat status | ✅ |
| 6 | **Dashboard & Analytics** — KPIs, floor utilization, project distribution, department breakdown, activity log | ✅ |
| 7 | **AI Assistant** — Natural-language queries with hybrid rule-based intent detection + template-based NLG + optional LLM refinement | ✅ |
| 8 | **REST APIs** — FastAPI with full Swagger/OpenAPI docs at `/docs` | ✅ |
| 9 | **Seed Data Generation** — 5,000 employees, 60 projects, 4 floors × 8 bays × 26 seats = 832 seats | ✅ |

---

## 🧱 Tech Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Recharts
- **Backend:** FastAPI 0.115 + SQLAlchemy 2 + Pydantic v2 + Uvicorn
- **Database:** PostgreSQL (production) / SQLite (local dev) — switchable via `DATABASE_URL`
- **AI Assistant:** Hybrid — rule-based intent detection + template-based natural-language generation (always works) + optional LLM refinement via `z-ai` CLI (best-effort)
- **Seed data:** Faker
- **Deployment targets:** Vercel (frontend), Render/Railway (backend), any Postgres host

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.11+ and `pip`
- Node.js 18+ and `npm`

### Option A: One-step launcher

```bash
bash start.sh
```

Starts both servers in the background:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs

### Option B: Manual setup

**1. Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # edit if using PostgreSQL

python -m scripts.seed_db --reset    # seed 5,000 employees (~30s)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**2. Frontend (in a new terminal):**
```bash
cd frontend
npm install
npm run dev
```

The frontend uses **relative URLs** (`/api/v1/...`) which are proxied to the
backend via `next.config.ts` rewrites. This avoids CORS issues and works in
preview environments where the backend port isn't directly exposed to the
browser. The proxy destination is controlled by the `BACKEND_URL` env var
(defaults to `http://localhost:8000`).

---

## 📂 Project Structure

```
ethara/
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI routers (projects, employees, seats, floors, dashboard, ai_assistant)
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
│   │   ├── app/                # Next.js App Router pages (7 pages)
│   │   ├── components/         # Sidebar, StatCard, PageHeader, Loading
│   │   ├── lib/                # API client, utils
│   │   └── types/              # TypeScript types matching backend schemas
│   ├── vercel.json             # Vercel deploy config
│   └── package.json
├── docs/                       # DATABASE_SCHEMA.md, DEPLOYMENT.md, DEBUGGING_NOTES.md
├── screenshots/                # 8 UI screenshots
├── render.yaml                 # Render backend + database blueprint
├── AI_PROMPTS.md               # AI usage documentation (14 entries)
├── README.md                   # This file
└── start.sh                    # One-shot launcher
```

---

## 🗄️ Database Schema

See [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) for the full schema with ER diagram.

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

The AI Assistant uses a **hybrid architecture** that always produces a natural-language answer:

1. **Rule-based intent detection** — regex patterns classify the query into one of 9 intents (available_seats, occupied_seats, new_joiners, floor_utilization, project_employees, employee_seat, project_distribution, department_distribution, total_stats).
2. **Data fetching** — based on the intent, the appropriate SQLAlchemy query runs against the DB and returns structured data.
3. **Template-based natural-language generation** — a deterministic per-intent template generates a polished natural-language answer from the structured data. **This always works**, regardless of environment.
4. **Optional LLM refinement** (best-effort) — if the `z-ai` CLI is available (sandbox/dev only), the template answer is refined by the LLM. On any failure (CLI missing, timeout, parse error), the template answer is used as-is.

This means the AI Assistant satisfies the "Natural Language Query Interface" requirement in every deployment environment — production without the LLM still gets real natural-language answers, not raw JSON.

**Sample queries:**
- "How many available seats are there on Floor 2?"
- "Show me all new joiners without a seat"
- "What is the floor-wise utilization?"
- "How many employees are in project Atlas?"
- "Where does employee ETH0001 sit?"
- "Give me an overall summary"

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
| - With seat | ~625 (75% seat utilization) |
| - Without seat (active) | ~4,125 (remote/hot-desk) |
| Activity logs | 50 sample entries |

To re-seed: `python -m scripts.seed_db --reset`
For a smaller dataset (1,000 employees): `python -m scripts.seed_db --reset --small`

---

## 🚢 Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full deployment instructions. Quick version:

### Backend → Render (uses `render.yaml`)

1. Push this repo to GitHub.
2. Go to https://render.com/deploy and connect your repo (or click "New Blueprint" and select the repo).
3. Render reads `render.yaml` and provisions:
   - A PostgreSQL database (`ethara-db`)
   - A Python web service (`ethara-backend`)
4. After first deploy, set `DATABASE_URL` (Render provides this automatically via the blueprint) and seed the DB:
   ```bash
   cd backend && source venv/bin/activate
   DATABASE_URL="<from Render dashboard>" python -m scripts.seed_db --reset
   ```

### Frontend → Vercel

1. Go to https://vercel.com/new and import your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add env var: `BACKEND_URL` = `https://<your-render-app>.onrender.com`
4. Deploy. Vercel auto-detects Next.js from `vercel.json`.

### After deployment

Update the live URLs at the top of this README with your Vercel + Render URLs.

---

## 🧪 Testing

Run the backend smoke tests:

```bash
cd backend
source venv/bin/activate
python scripts/test_endpoints.py
```

This hits every endpoint with sample requests and verifies responses. All 24 endpoints return 200/201/204 in the latest run.

---

## 📝 Documentation

- [`AI_PROMPTS.md`](AI_PROMPTS.md) — AI usage documentation (14 entries, required by assessment)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — Schema with ER diagram
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Deployment guides for Vercel + Render
- [`docs/DEBUGGING_NOTES.md`](docs/DEBUGGING_NOTES.md) — 11 issues encountered & resolutions
- [`screenshots/`](screenshots/) — 8 UI screenshots of all pages

---

## 📋 Submission Checklist

| Deliverable | Status |
|-------------|--------|
| GitHub Repository URL | ⚠️ Push to your GitHub account |
| Live Frontend URL | ⚠️ Deploy to Vercel |
| Live Backend URL | ⚠️ Deploy to Render |
| README.md | ✅ |
| AI_PROMPTS.md | ✅ |
| Database Schema | ✅ `docs/DATABASE_SCHEMA.md` |
| Seed Data | ✅ `backend/scripts/seed_db.py` |
| API Documentation / Swagger URL | ✅ `/docs` endpoint (becomes live URL after deploy) |
| Screenshots | ✅ 8 PNGs in `screenshots/` |
| Deployment Notes | ✅ `docs/DEPLOYMENT.md` |
| Debugging Notes | ✅ `docs/DEBUGGING_NOTES.md` |

---

## 📜 License

Built as a technical assessment submission for Ethara.
