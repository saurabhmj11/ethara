# AI_PROMPTS.md

## Ethara Seat Allocation & Project Mapping System — AI Usage Documentation

This document records every instance where an AI tool was used during the
development of this assessment, per the submission requirements. Each entry
includes the prompt given, a summary of the output, any manual fixes applied,
and how the result was validated.

**AI Tool(s) used:** Claude (Anthropic) — via the Super Z coding assistant
**Primary use case:** Scaffolding, schema design, backend code, frontend code, seed data, debugging, documentation

---

## How to use this file

Add one entry per meaningful AI interaction (not every single message —
group related back-and-forth into one logical entry, e.g. "designing the
seat allocation schema" rather than one entry per line of chat). Copy the
template block below for each new entry and fill it in as you go, in
chronological order. Keep entries honest — the reviewer is assessing your
judgment in using AI, not just the final code.

---

## Entry Template

### [#] — <Short Descriptive Title>
- **Date/Time:**
- **Tool:**
- **Category:** (Planning / Schema Design / Backend / Frontend / API / Seed Data / AI Assistant Feature / Deployment / Debugging / Documentation)
- **Prompt used:**
  ```
  <paste exact prompt here>
  ```
- **Output summary:** What the AI produced (code, plan, explanation). Link to
  the relevant file/commit if applicable, e.g. `backend/app/models/seat.py`.
- **Manual fixes applied:** What you changed, and why (bugs, security
  issues, style, requirements the AI missed, hallucinated APIs, etc.)
- **Validation method:** How you confirmed it was correct — unit test,
  manual test steps, Swagger call, DB query, code review, etc.

---

## Log

### 1 — Project scaffolding & architecture plan
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Planning
- **Prompt used:**
  ```
  Build a full-stack application for the Ethara Seat Allocation & Project
  Mapping System assessment. Backend: FastAPI + SQLAlchemy + PostgreSQL
  (SQLite fallback for dev). Frontend: Next.js + Tailwind + shadcn/ui +
  Recharts. Features: Employee Management, Project Mapping, Seat
  Allocation & Release, New Joiner Seat Allocation, Search & Filter,
  Dashboard & Analytics, AI Assistant, REST APIs, Seed Data (5000 emp).
  Include all submission docs.
  ```
- **Output summary:** AI proposed the full architecture: directory layout (`backend/app/{api,core,models,schemas,services}/`, `frontend/src/app/`), tech stack choices, REST API surface, hybrid AI Assistant (rule-based intent detection + LLM response generation), seed data strategy, and the documentation deliverables list. Generated the initial `TodoWrite` plan with 8 tasks.
- **Manual fixes applied:** 
  - Removed `z-ai-web-dev-sdk==0.1.0` from `requirements.txt` after install failure — that's a Node.js package, not Python. Switched to calling the `z-ai` CLI via `subprocess` from Python.
  - Changed `pydantic_settings.BaseSettings` config from `class Config:` to `model_config = SettingsConfigDict(...)` for Pydantic v2 compatibility.
  - Added `email-validator==2.2.0` to requirements for `EmailStr` Pydantic type.
- **Validation method:** Confirmed backend app loads with `python -c "from app.main import app; print('OK')"`; ran full smoke test suite (`scripts/test_endpoints.py`).

---

### 2 — Database schema design (employees, projects, seats, allocations)
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Schema Design
- **Prompt used:**
  ```
  Design SQLAlchemy models for: Employee, Project, Floor, Bay, Seat,
  ActivityLog. Employee has status (ACTIVE/ONBOARDING/INACTIVE), belongs
  to a Project (optional), has one Seat (optional, unique). Seat has
  status (OCCUPIED/AVAILABLE/RESERVED/MAINTENANCE) and belongs to a Bay,
  which belongs to a Floor. Seat can be reserved_for_employee_id (for new
  joiners). Add indexes on commonly-filtered columns and unique
  constraints on seat_number, project.code, employee.emp_code, employee.email.
  ```
- **Output summary:** AI produced `backend/app/models/__init__.py` with 6 ORM classes, two Python enums (`EmployeeStatus`, `SeatStatus`), `UniqueConstraint`, `Index`, and `relationship()` declarations with appropriate `back_populates` and `cascade="all, delete-orphan"` for parent-child relationships.
- **Manual fixes applied:**
  - Added `post_update=True` to the `Employee.seat` relationship to avoid circular FK issue (Employee.seat_id → Seat.id, Seat.reserved_for_employee_id → Employee.id).
  - Used `String` columns for status enums (with `.value` access) instead of SQLAlchemy `Enum` type for easier JSON serialization in Pydantic.
  - Added composite index `ix_seat_status_bay` for the seat list query that filters by both.
- **Validation method:** `Base.metadata.create_all()` succeeded; verified table structure with `sqlite3 ethara.db ".schema"`; ran seed script which populated all tables without constraint errors.

---

### 3 — Seed data generation (~5,000 employees)
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Seed Data
- **Prompt used:**
  ```
  Write a seed script using Faker that generates: 4 floors × 8 bays × 26
  seats = 832 seats, 60 projects (realistic names from a curated list +
  domain suffixes like "Atlas — Platform"), 5000 employees (95% ACTIVE,
  5% ONBOARDING new joiners without seats). Active employees get a seat
  ~75% of the time (hot-desking model) so we leave some seats AVAILABLE
  for demo. Mark a few seats as MAINTENANCE. Generate unique emp_codes
  (ETH0001...ETH5000), unique emails, and 50 sample activity log entries.
  Support --reset and --small flags.
  ```
- **Output summary:** AI produced `backend/scripts/seed_db.py` (~270 lines) with the `Faker`-based generator, configurable sizes via `--small` flag, deterministic seeding (`Faker.seed(42)`), and a summary print at the end. Used `PROJECT_NAMES` and `PROJECT_DOMAINS` curated lists for realistic project names.
- **Manual fixes applied:**
  - Changed initial allocation ratio from 92% (which over-allocated all seats) to 75% so we'd have ~200 available seats for demo.
  - Fixed the seat pool exhaustion issue: original code tried to give seats to all 950 active employees but only had 160 seats in the small dataset. Increased small-dataset floors to 4 × 8 bays × 26 seats = 832.
  - Used `Faker.seed(42)` and `random.seed(42)` for reproducibility.
- **Validation method:** Ran `python -m scripts.seed_db --reset` — confirmed 5,000 employees, 250 new joiners, 204 available seats, 624 occupied seats, 4 maintenance seats, 75% utilization. Verified counts via the dashboard `/api/v1/dashboard/stats` endpoint.

---

### 4 — FastAPI backend: employee management endpoints
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Backend / API
- **Prompt used:**
  ```
  Build FastAPI routes for /employees with: GET (paginated, search by
  name/email/code, filter by status/department/project_id/floor_id/bay_id/
  has_seat), GET /{id}, POST, PUT, DELETE. Use the schemas and CRUD
  service layer. Also add GET /employees/departments returning distinct
  departments for the filter dropdown.
  ```
- **Output summary:** AI produced `backend/app/api/employees.py` with all CRUD endpoints, plus a separate `/employees/departments` endpoint. The list endpoint accepts `Query` parameters with validation (`ge=0`, `ge=1, le=500`).
- **Manual fixes applied:**
  - Added enrichment logic in the CRUD layer so `list_employees()` returns `project_name`, `project_code`, `seat_number`, `bay_name`, `floor_name` as joined fields — the frontend needs these for display.
  - Added `has_seat: Optional[bool]` filter to support the "Has Seat / No Seat" dropdown.
- **Validation method:** Smoke test confirmed all 5 employee endpoints return 200; verified filtering with `?status=ONBOARDING` returned 250 new joiners.

---

### 5 — FastAPI backend: seat allocation & release logic
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Backend / API
- **Prompt used:**
  ```
  Build seat allocation logic in the CRUD service with these endpoints:
  POST /seats/allocate (employee_id, seat_id) — fails if seat is occupied
  or under maintenance; releases employee's previous seat if any;
  promotes ONBOARDING employees to ACTIVE. POST /seats/release (seat_id)
  — frees the seat and unsets employee.seat_id. POST /seats/reserve
  (seat_id, employee_id) — for new joiners; sets seat status to RESERVED.
  All operations should write to ActivityLog for audit trail.
  ```
- **Output summary:** AI produced `allocate_seat()`, `release_seat()`, `reserve_seat()` in `backend/app/services/crud.py`. Each function returns `(success, message, seat, employee)` tuple so the API layer can raise appropriate HTTP errors. All three write to `ActivityLog` with action type, actor, employee_id, seat_id, and a human-readable details string.
- **Manual fixes applied:**
  - Added a check in `allocate_seat()` to release the employee's *previous* seat before assigning the new one (prevents orphaned occupied seats).
  - Added status promotion: `if employee.status == EmployeeStatus.ONBOARDING.value: employee.status = EmployeeStatus.ACTIVE.value` — when a new joiner is allocated a seat, they become active.
  - `release_seat()` also clears `reserved_for_employee_id` in case the seat was previously reserved.
- **Validation method:** Ran end-to-end flow in `test_endpoints.py`: picked an available seat + onboarding employee, called `/seats/allocate-new-joiner`, confirmed response showed the new seat number and the employee was promoted. Verified via `/dashboard/activity-logs` that the action was logged.

---

### 6 — New joiner seat allocation workflow
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Backend
- **Prompt used:**
  ```
  Build POST /seats/allocate-new-joiner that auto-picks an available seat
  for an onboarding employee. Strategy: (1) Try to find a seat in the same
  bay as the new joiner's project teammates (clustering). (2) If a
  preferred_floor_id is provided, pick an available seat on that floor.
  (3) Otherwise pick any available seat. Fail if employee is not
  ONBOARDING or already has a seat. Return the allocated seat_number.
  ```
- **Output summary:** AI produced `allocate_new_joiner()` in `crud.py` implementing the three-tier strategy. The function queries for teammates (employees with the same `project_id` who have seats), finds their `bay_id`s, then looks for an available seat in any of those bays. Falls back to preferred floor, then any available seat.
- **Manual fixes applied:**
  - Added a guard at the top: `if employee.status != EmployeeStatus.ONBOARDING.value` → return error. Originally the AI allowed allocating to ACTIVE employees too, which would have been ambiguous.
  - Added a "no seats available" failure path with a clear error message.
- **Validation method:** Tested in `test_endpoints.py`: called with an onboarding employee, confirmed seat was allocated (and happened to be in a bay with teammates). Bulk allocation in the New Joiners UI worked for 50 employees with 0 failures.

---

### 7 — Search & filter functionality
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Backend / Frontend
- **Prompt used:**
  ```
  Build the search & filter UI on the Employees page: text search across
  name/email/code/designation, dropdowns for status, department, project,
  floor, and seat status (has seat / no seat). All filters should hit the
  API with proper query params and reset pagination to page 1 when
  changed. Show total count and pagination controls.
  ```
- **Output summary:** AI produced `frontend/src/app/employees/page.tsx` with a 6-column filter bar, paginated table, and `useCallback`-based loading that re-fetches when any filter changes. Department list is fetched once and cached.
- **Manual fixes applied:**
  - Wrapped the `load()` function in `useCallback` with proper deps so it doesn't refetch on every render.
  - Cached the departments list with `departments.length === 0 ? ... : Promise.resolve(departments)` to avoid refetching on every page change.
  - Added `resetPage()` helper that sets page=1 when filters change.
- **Validation method:** Manually tested each filter in the browser — searched "eth" (5000 matches since emp_code starts with ETH), filtered by status=ONBOARDING (250 results), filtered by has_seat=no (4126 active + 250 new joiners = 4376).

---

### 8 — Dashboard & analytics (utilization metrics, charts)
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Frontend
- **Prompt used:**
  ```
  Build two pages: (1) Dashboard with KPI cards (total employees, new
  joiners, utilization %, active projects), floor-wise utilization bar
  chart, seat status pie chart, top projects bar chart, department pie
  chart, recent activity log. (2) Analytics page with radial bar chart
  for floor utilization %, department headcount bar chart, top 15
  projects chart, stacked floor capacity chart, full activity log table.
  Use Recharts. Fetch all data from the dashboard API endpoints.
  ```
- **Output summary:** AI produced `frontend/src/app/page.tsx` (Dashboard) and `frontend/src/app/analytics/page.tsx` (Analytics) with Recharts components: `BarChart`, `PieChart`, `RadialBarChart`, `AreaChart`. Color-coded utilization (green ≤ 60%, amber 60-80%, red > 80%).
- **Manual fixes applied:**
  - Fixed TypeScript error: `label={(e) => e.department}` failed type check because Recharts `PieLabelRenderProps` doesn't include arbitrary data fields. Changed to `label={(e: any) => e.department}`.
  - Used `constrained_layout`-equivalent: explicit `margin` props and `outerRadius` values to prevent chart overflow.
  - Added loading and error states for all chart containers.
- **Validation method:** Visual inspection in browser — all 4 dashboard charts and 4 analytics charts rendered correctly with real seed data. KPIs matched the `/dashboard/stats` API response.

---

### 9 — AI Assistant / natural language query interface
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** AI Assistant Feature
- **Prompt used:**
  ```
  Build a hybrid AI Assistant for the seat allocation system. (1)
  Rule-based intent detection using regex patterns — classify user query
  into 9 intents: available_seats, occupied_seats, new_joiners,
  floor_utilization, project_employees, employee_seat, project_distribution,
  department_distribution, total_stats. (2) For each intent, run the
  appropriate SQLAlchemy query to fetch structured data. (3) Pass the
  query + structured data to the z-ai LLM via subprocess (z-ai CLI) with
  a system prompt instructing it to write a concise natural-language
  answer. Return {query, answer, data, intent, elapsed_ms}.
  ```
- **Output summary:** AI initially produced `backend/app/services/ai_assistant.py` with `detect_intent()` regex matcher, 9 `fetch_*` functions, `call_llm()` that invokes `z-ai` CLI via `subprocess`, and `answer_query()` orchestrator.
- **Manual fixes applied:**
  - **Major rework after code review:** Original implementation depended entirely on the `z-ai` CLI for natural-language generation. When the CLI isn't available (e.g., on Render/Vercel production without it installed), the assistant returned raw JSON plus a fallback message — failing the "natural language" requirement.
  - Rewrote as a true hybrid: (1) template-based NLG runs first and always produces a real natural-language answer, (2) LLM refinement runs as best-effort on top of the template answer, (3) if LLM is unavailable, the template answer is returned as-is. Added `llm_used: bool` field to the response so callers can see which path ran.
  - Wrote per-intent template generators (`generate_answer_template`) that produce polished natural language for all 9 intents using only the structured data — no LLM required.
  - The z-ai CLI is invoked via `subprocess.run()` with `timeout=15` and best-effort JSON parsing. On any error (CLI missing, timeout, parse failure, empty response), returns `None` and the caller falls back to the template answer.
  - The intent priority order matters: `available_seats` is checked before `total_stats` so "how many available seats" doesn't match the generic "how many" pattern.
  - For `employee_seat` intent, the AI's original code tried to extract names with a complex regex; replaced with a simple substring match against all employees (works fine for 5,000 records).
- **Validation method:**
  - Tested all 6 sample queries via the `/ai/query` endpoint with LLM enabled — all return polished natural-language answers in 1.3-3.3s.
  - Tested the template generator in isolation (bypassing LLM) — produces real natural-language answers for all 9 intents. Sample template output for "How many available seats are there?": `"There are **203 available seats** right now. Breakdown by floor — Floor 1: 5 seats. Sample seat numbers: F1-A-001, F1-A-004, F1-A-008, F1-A-012, F1-A-016 and 15 more. You can allocate any of these to a new joiner via the New Joiners page or the Seat Map."`
  - Confirmed the assistant works in production environments without the `z-ai` CLI — the template-based NLG always produces a real natural-language answer.

---

### 10 — Frontend UI build (React/Next.js + Tailwind components)
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Frontend
- **Prompt used:**
  ```
  Build the full Next.js frontend with: sidebar navigation (Dashboard,
  Employees, Projects, Seat Map, New Joiners, Analytics, AI Assistant,
  link to Swagger). Tailwind styling with card-based layout, KPI cards,
  paginated tables, badges for status, seat grid with color-coded
  statuses, chat UI for AI assistant. All pages should fetch from the
  FastAPI backend at http://localhost:8000.
  ```
- **Output summary:** AI produced 7 page components, a shared `Sidebar` component, `StatCard` component, API client (`lib/api.ts`), TypeScript types matching backend Pydantic schemas (`types/index.ts`), and utility functions. Total ~1,500 lines of TypeScript/TSX. The Seat Map page renders an interactive grid of seats colored by status; clicking a seat opens a side panel for allocation/release.
- **Manual fixes applied:**
  - Fixed two TypeScript strict-mode errors during `npm run build`: missing type annotation on `forEach((s) => ...)` callback in seats page, and missing `import type` statement at top of `api.ts`.
  - Replaced Geist font with Inter (more universally available).
  - Added `cache: "no-store"` to all fetch calls to prevent Next.js from caching API responses during development.
- **Validation method:** `npm run build` succeeded with no TypeScript errors. Manual browser test of all 7 pages confirmed they render correctly and fetch live data. Captured 8 screenshots via `agent-browser`.

---

### 11 — API documentation / Swagger setup
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Documentation
- **Prompt used:**
  ```
  Configure FastAPI with Swagger UI at /docs and ReDoc at /redoc. Add
  meaningful title, description, version, and tags for each router.
  ```
- **Output summary:** AI configured `app/main.py` with `FastAPI(title=..., description=..., docs_url="/docs", redoc_url="/redoc")` and `tags=["Projects"]`, `["Employees"]`, etc. on each router.
- **Manual fixes applied:** None — FastAPI auto-generates OpenAPI from Pydantic schemas, so no extra work needed.
- **Validation method:** Visited http://localhost:8000/docs — all endpoints visible with request/response schemas, try-it-out functionality works. Screenshot saved as `screenshots/08-swagger.png`.

---

### 12 — Deployment configuration
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Deployment
- **Prompt used:**
  ```
  Write deployment configs for: Vercel (frontend), Render (backend), and
  a docker-compose for local PostgreSQL. Include env var docs.
  ```
- **Output summary:** AI produced `docs/DEPLOYMENT.md` with step-by-step instructions for Vercel + Render, `frontend/.env.example` with `NEXT_PUBLIC_API_URL`, and notes on PostgreSQL connection string formats.
- **Manual fixes applied:**
  - Clarified that the backend's `DATABASE_URL` must be in SQLAlchemy format: `postgresql+psycopg2://user:pass@host:5432/dbname` (not the plain `postgres://` URL that Render/Railway provide by default).
  - Added note about `z-ai` CLI needing to be installed on the backend host for the AI Assistant to work.
- **Validation method:** Reviewed configs against Vercel/Render documentation; confirmed env var names match between `.env.example` files and the deployment guides.

---

### 13 — Debugging session(s)
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Debugging
- **Prompt used:**
  ```
  Document all debugging issues encountered during development.
  ```
- **Output summary:** See `docs/DEBUGGING_NOTES.md` for the full list of 7 issues encountered and their resolutions.
- **Manual fixes applied:** Documented each issue with root cause and fix.
- **Validation method:** Each issue was confirmed fixed by re-running the failing command (build, seed, test, etc.).

**Key issues documented:**
1. `z-ai-web-dev-sdk` not installable via pip — it's a Node.js package
2. Pydantic v2 `class Config` deprecated → `model_config = SettingsConfigDict(...)`
3. Inherited `DATABASE_URL` env var from shell overriding `.env` file
4. Background uvicorn processes dying between bash tool calls — solved with `setsid` + `disown`
5. Recharts TypeScript error on `label={(e) => e.department}` — added `any` cast
6. Seat over-allocation in seed script — reduced allocation ratio to 75%
7. SQLAlchemy circular FK between Employee.seat_id and Seat.reserved_for_employee_id — added `post_update=True`

---

### 14 — README / final documentation
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Documentation
- **Prompt used:**
  ```
  Write a comprehensive README.md with: features table, tech stack, quick
  start (backend + frontend), project structure, database schema
  overview, API overview table, AI Assistant explanation, seed data
  table, testing instructions, links to all other docs.
  ```
- **Output summary:** AI produced `README.md` (this file's parent) — comprehensive but not bloated, with feature checklist, tech stack, quick-start commands, project structure tree, API endpoint table, and links to all other docs.
- **Manual fixes applied:**
  - Manually verified every command in the Quick Start section actually works.
  - Confirmed all internal doc links resolve to real files.
- **Validation method:** Followed the Quick Start steps from scratch in a clean shell — both servers started successfully, seed ran, frontend loaded with data.

---

### 15 — Production Deployment & Debugging (Netlify + Render)
- **Date/Time:** 2026-07-08
- **Tool:** Claude (via Super Z)
- **Category:** Deployment / Debugging
- **Prompt used:**
  ```
  Now I will deploy frontend on netlify. Help fix the 404 issue. Also, the 
  Render backend seed script is failing silently in the background, deploy 
  a debug endpoint to see what's wrong and fix the deployment.
  ```
- **Output summary:** AI created a `GET /api/seed-debug` endpoint to catch silent backend errors, which surfaced a CircularDependencyError in SQLAlchemy during `DROP TABLE`. AI also identified that Next.js wasn't building properly on Netlify due to missing static exports and sub-folder configuration. 
- **Manual fixes applied:** 
  - Moved `netlify.toml` to the root folder to support monorepo detection.
  - Configured `next.config.ts` to conditionally use `output: "export"` for production static hosting, avoiding Next.js plugin conflicts on Netlify.
  - Modified the backend seed endpoint to skip `reset_database()` (DROP TABLE) entirely since the Render production DB was already fresh, preventing the circular dependency crash.
  - Converted the seed endpoint to accept `GET` requests so it could be easily triggered from the browser.
- **Validation method:** 
  - Render deployment succeeded; hitting `/api/seed-database` successfully populated the database in ~30s.
  - Netlify build succeeded and the live URL rendered perfectly, correctly proxying absolute requests directly to the Render backend.

---

## Summary

- **Total AI-assisted entries:** 15
- **Estimated % of codebase AI-generated vs. hand-written:** ~85% AI-generated, ~15% manual fixes and review. All AI output was reviewed and tested before being committed.
- **Areas where AI was most useful:**
  - Initial scaffolding and architecture planning
  - SQLAlchemy model design with relationships
  - FastAPI route handlers with Pydantic validation
  - Recharts chart components
  - Seed data generation with Faker
  - The hybrid AI Assistant (rule-based + LLM) was a particularly elegant AI-suggested design
- **Areas where AI struggled / required significant manual correction:**
  - Hallucinated that `z-ai-web-dev-sdk` is a Python package (it's Node.js)
  - Used deprecated Pydantic v1 `class Config` syntax in Pydantic v2 codebase
  - Initial seed allocation ratios caused all seats to be occupied (no demo data left)
  - TypeScript strict mode caught several implicit `any` types in Recharts callbacks
  - Background process management with `nohup` was unreliable — switched to `setsid`
- **Overall validation approach:** All endpoints manually tested via the smoke test script (`scripts/test_endpoints.py`) which hits every endpoint; schema verified by running the seed and querying the dashboard stats endpoint; frontend flows tested manually in browser for each page; AI Assistant validated by sending 8 different natural-language queries and confirming correct intent detection and LLM responses.
