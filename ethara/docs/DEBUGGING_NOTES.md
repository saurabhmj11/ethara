# Debugging Notes

This document logs issues encountered during development and their resolutions.

---

## Issue 1: `z-ai-web-dev-sdk` not installable via pip

**Symptom:**
```
ERROR: Could not find a version that satisfies the requirement z-ai-web-dev-sdk==0.1.0
ERROR: No matching distribution found for z-ai-web-dev-sdk
```

**Root cause:** `z-ai-web-dev-sdk` is a **Node.js** package (npm), not a Python package. It was incorrectly listed in `backend/requirements.txt`.

**Fix:**
1. Removed `z-ai-web-dev-sdk==0.1.0` from `requirements.txt`.
2. The AI Assistant now calls the LLM via the `z-ai` CLI using `subprocess.run(["z-ai", "chat", ...])` from Python.
3. The `z-ai` CLI is pre-installed on the dev environment. For production deployment, the build script needs `npm install -g z-ai-web-dev-sdk` (see `docs/DEPLOYMENT.md`).

**Files affected:** `backend/requirements.txt`, `backend/app/services/ai_assistant.py`

---

## Issue 2: Pydantic v2 Settings class config deprecation

**Symptom:**
```
PydanticDeprecationWarning: The `class Config` style is deprecated, use `model_config = SettingsConfigDict(...)`
```

**Root cause:** The `Settings` class used Pydantic v1's `class Config:` inner class, but the project uses Pydantic v2 + `pydantic-settings`.

**Fix:**
```python
# Before
class Settings(BaseSettings):
    ...
    class Config:
        case_sensitive = True
        env_file = ".env"

# After
class Settings(BaseSettings):
    ...
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")
```

Also added `extra="ignore"` to prevent errors when the shell has unrelated env vars (like the inherited `DATABASE_URL`).

**Files affected:** `backend/app/core/config.py`

---

## Issue 3: Inherited `DATABASE_URL` env var overriding `.env` file

**Symptom:**
```
sqlalchemy.exc.ArgumentError: Could not parse SQLAlchemy URL from string 'file:/home/z/my-project/db/custom.db'
```

**Root cause:** The dev environment had a `DATABASE_URL` env var pre-set to a non-SQLAlchemy format (`file:...`). The original config used `os.getenv("DATABASE_URL", "sqlite:///./ethara.db")`, which picked up the inherited value.

**Fix:**
1. Removed `os.getenv()` calls from `Settings` class — let Pydantic load everything from `.env`.
2. Used explicit `load_dotenv(dotenv_path=...)` to load the `.env` file from the backend directory.
3. Run all commands with `unset DATABASE_URL` prefix in the dev shell.
4. Added `extra="ignore"` to the Pydantic Settings model.

**Files affected:** `backend/app/core/config.py`

---

## Issue 4: Background uvicorn processes dying between bash tool calls

**Symptom:** Start `uvicorn` in background with `nohup ... &`, verify it's running with `curl`, then on the next bash tool call (a few seconds later), the process is gone.

**Root cause:** The bash tool runs each command in a fresh shell session. When the session ends, child processes started with `&` get SIGHUP and die. `nohup` should prevent this, but the tool's process group management was killing them anyway.

**Fix:** Use `setsid` + `disown` to fully detach the process from the shell:
```bash
setsid uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 < /dev/null &
disown
```

`setsid` creates a new session, and `< /dev/null` redirects stdin so the process doesn't wait for terminal input. `disown` removes it from the shell's job table.

For long-running screenshots, wrote a single bash script (`scripts/capture_screenshots.sh`) that starts both servers, waits for them, takes all screenshots, and exits — all within one bash tool call.

**Files affected:** `start.sh`, `scripts/capture_screenshots.sh`

---

## Issue 5: Recharts TypeScript error on `label` render prop

**Symptom:**
```
Type error: Property 'department' does not exist on type 'PieLabelRenderProps'.
```

**Root cause:** Recharts' `Pie` component's `label` prop expects a function with the signature `(props: PieLabelRenderProps) => React.ReactNode`. The `PieLabelRenderProps` type doesn't include arbitrary data fields like `department` — only rendering-related properties.

**Fix:** Cast the parameter to `any`:
```tsx
// Before
<Pie data={departments} ... label={(e) => e.department}>

// After
<Pie data={departments} ... label={(e: any) => e.department}>
```

This is acceptable because Recharts does pass the data fields at runtime — they're just not in the TypeScript types.

**Files affected:** `frontend/src/app/page.tsx`, `frontend/src/app/analytics/page.tsx`

---

## Issue 6: Seat over-allocation in seed script

**Symptom:** After running the seed, `available_seats` was 0 and `occupied_seats` was 832 (100% utilization). No seats were left for the New Joiners auto-allocation demo.

**Root cause:** The original seed logic allocated seats to 92% of active employees:
```python
if not is_new_joiner and seat_idx < len(seat_pool) and random.random() < 0.92:
    seat = seat_pool[seat_idx]
    ...
```

With 950 active employees and 160 seats (in the `--small` config), `seat_idx` quickly exceeded `len(seat_pool)`, but with the full dataset (5,000 employees, 832 seats), all 832 seats got allocated.

**Fix:** Cap allocation at 75% of seat capacity to leave ~200 seats for demo:
```python
max_occupy = int(len(seat_pool) * 0.75)
if not is_new_joiner and seat_idx < max_occupy and random.random() < 0.85:
    ...
```

Result: 624 occupied (75%), 204 available (24.5%), 4 maintenance (0.5%) — exactly the demo-friendly distribution we wanted.

**Files affected:** `backend/scripts/seed_db.py`

---

## Issue 7: SQLAlchemy circular foreign key between Employee and Seat

**Symptom:**
```
sqlalchemy.exc.CircularDependencyError: Circular dependency detected between tables
```

**Root cause:** Two FK relationships create a cycle:
- `Employee.seat_id → Seat.id` (employee's assigned seat)
- `Seat.reserved_for_employee_id → Employee.id` (new joiner reservation)

SQLAlchemy can't resolve the order of `CREATE TABLE` statements.

**Fix:** Add `post_update=True` to one of the relationships so SQLAlchemy creates the tables first, then updates the FK in a second pass:
```python
class Employee(Base):
    ...
    seat = relationship("Seat", foreign_keys=[seat_id], post_update=True)
```

**Files affected:** `backend/app/models/__init__.py`

---

## Issue 8: TypeScript implicit `any` in `forEach` callback

**Symptom:**
```
Type error: Parameter 's' implicitly has an 'any' type.
```

**Root cause:** Next.js's TypeScript config has `strict: true`. Even though `seatsResp.items` is typed as `Seat[]`, the callback parameter needed explicit annotation:

**Fix:**
```typescript
// Before
seatsResp.items.forEach((s) => { ... });

// After
seatsResp.items.forEach((s: Seat) => { ... });
```

**Files affected:** `frontend/src/app/seats/page.tsx`

---

## Issue 9: Missing type imports in API client

**Symptom:**
```
Type error: Cannot find name 'DashboardStats'.
```

**Root cause:** The API client (`lib/api.ts`) referenced TypeScript types like `DashboardStats`, `FloorUtilization`, etc. in generic parameters, but didn't import them.

**Fix:** Added explicit type imports at the top of `api.ts`:
```typescript
import type {
  Project, Floor, Bay, Seat, Employee,
  DashboardStats, FloorUtilization, ProjectDistribution,
  DepartmentDistribution, ActivityLog, PaginatedResponse, AIResponse,
} from "@/types";
```

**Files affected:** `frontend/src/lib/api.ts`

---

## Issue 10: "Failed to fetch" TypeError in browser console (preview environment)

**Symptom:**
```
Console TypeError: Failed to fetch
    at fetchJson (...)
    at Object.listEmployees (...)
    ...
```

The browser could not reach `http://localhost:8000` because that URL only exists in the sandbox where the FastAPI backend runs — not on the user's machine where the browser is executing JavaScript.

**Root cause:** The frontend's API client was using `NEXT_PUBLIC_API_URL || "http://localhost:8000"` as the base for fetch calls. In a preview environment (e.g., `https://preview-<bot-id>.space-z.ai/`), the browser is on the user's machine and only has access to the Next.js dev server via the preview proxy. It does NOT have direct access to port 8000 on the sandbox.

**Fix:** Switch the frontend to use **relative URLs** (`/api/v1/...`) and configure Next.js to proxy those requests to the backend server-side via `rewrites()` in `next.config.ts`. The Next.js server (running in the sandbox) makes the request to `http://localhost:8000` on behalf of the browser, then returns the response.

**Files affected:**
- `frontend/src/lib/api.ts` — changed default `API_BASE` from `"http://localhost:8000"` to `""` (relative)
- `frontend/next.config.ts` — added `rewrites()` to proxy `/api/:path*` → `${BACKEND_URL}/api/:path*`
- `frontend/src/components/Sidebar.tsx` — changed Swagger link from absolute URL to relative `/docs`
- `frontend/.env.example` — documented new `BACKEND_URL` env var and updated `NEXT_PUBLIC_API_URL` usage

**Validation:** Restarted the Next.js dev server (config changes require restart). Tested `curl http://localhost:3000/api/v1/dashboard/stats` — returned the expected JSON from the backend. Tested `curl http://localhost:3000/docs` — returned the Swagger UI HTML (200 OK).

**Production note:** In production on Vercel, set `BACKEND_URL=https://<your-backend>.onrender.com` so the server-side proxy can reach the backend. The browser only ever sees relative URLs, so no CORS configuration is needed (though the backend still allows `*` as a fallback).

---

## Issue 11: Employee search/filter endpoints returning HTTP 500

**Symptom:** The audit script flagged that several employee filter endpoints returned HTTP 500:
```
GET /api/v1/employees?search=john           → 500
GET /api/v1/employees?status=ACTIVE         → 500
GET /api/v1/employees?has_seat=false        → 500
```

**Root cause:** Backend logs showed:
```
pydantic_core._pydantic_core.ValidationError: 1 validation error for EmployeeOut
email
  value is not a valid email address: An email address cannot have two periods
  in a row. [type=value_error, input_value='dr..john.collier@ethara.com', ...]
```

The seed script generated email addresses from `fake.name()` results that included prefixes like "Mr.", "Mrs.", "Dr." and suffixes like "Jr.", "MD", "PhD". Lowercasing and replacing spaces with dots produced invalid emails:
- `Dr. John Collier` → `dr..john.collier@ethara.com` (double dot)
- `Mr. Anthony Adams Jr.` → `mr..anthony.adams.jr.@ethara.com` (double dot + trailing dot)

Pydantic's `EmailStr` validator rejected these when serializing the response, causing a 500.

Out of 5,000 seeded employees, 98 had invalid email addresses.

**Fix:** Updated `backend/scripts/seed_db.py` to strip leading titles and trailing suffixes from the name before generating the email, and to collapse any accidental double dots:
```python
name_for_email = re.sub(r"^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+", "", full_name)
name_for_email = re.sub(r",?\s+(Jr\.|Sr\.|II|III|IV|MD|PhD|DDS)$", "", name_for_email)
base = name_for_email.lower().replace(" ", ".")
base = re.sub(r"\.+", ".", base).strip(".")
```

After re-seeding with `python -m scripts.seed_db --reset`, all 5,000 employee emails are valid and all filter endpoints return 200.

**Files affected:** `backend/scripts/seed_db.py` (added `import re` and the regex sanitization)

**Validation:** Re-ran the audit:
```
HTTP 200  total=151    /api/v1/employees?search=john
HTTP 200  total=4750   /api/v1/employees?status=ACTIVE
HTTP 200  total=326    /api/v1/employees?department=Engineering
HTTP 200  total=84     /api/v1/employees?project_id=1
HTTP 200  total=154    /api/v1/employees?floor_id=1
HTTP 200  total=4376   /api/v1/employees?has_seat=false
```

---

## Issue 12: AI Assistant returned raw JSON instead of natural language when LLM was unavailable

**Symptom:** Reviewer flagged that the AI Assistant endpoint returned:
```
"[LLM unavailable (z-ai CLI not installed)] Could not generate a natural language response."
```
instead of a real natural-language answer. This happened because the original implementation relied entirely on the `z-ai` CLI for natural-language generation — when the CLI isn't installed (which is the case on Render/Vercel production unless explicitly added to the build step), the assistant fell back to returning raw structured data.

**Root cause:** The original `call_llm()` function was the only path to natural-language output. When it failed, there was no template-based fallback — just an error message. This violates the "Natural Language Query Interface" requirement, which expects a natural-language answer regardless of environment.

**Fix:** Rewrote `backend/app/services/ai_assistant.py` as a true hybrid:

1. **Template-based NLG runs first** (`generate_answer_template`) — a deterministic per-intent template generator that produces polished natural language for all 9 intents using only the structured data. This always works, regardless of environment.
2. **LLM refinement is best-effort** (`_try_llm_refine`) — if the `z-ai` CLI is available, the template answer is sent to the LLM for refinement. On any error (CLI missing, timeout, parse failure, empty response), the LLM step returns `None` and the template answer is used as-is.
3. Added `llm_used: bool` field to the response so callers can see which path ran.

Sample template output for "How many available seats are there?":
```
There are **203 available seats** right now. Breakdown by floor — Floor 1: 5 seats.
Sample seat numbers: F1-A-001, F1-A-004, F1-A-008, F1-A-012, F1-A-016 and 15 more.
You can allocate any of these to a new joiner via the New Joiners page or the Seat Map.
```

**Files affected:** `backend/app/services/ai_assistant.py` (rewrote NLG architecture), `backend/app/schemas/__init__.py` (added `llm_used` field to `AIResponse`)

**Validation method:**
- Tested 6 sample queries via `/api/v1/ai/query` with LLM enabled — all return polished natural-language answers in 1.3-3.3s with `llm_used: true`.
- Tested `generate_answer_template()` in isolation (bypassing LLM) — produces real natural-language answers for all 9 intents.
- This means production deployments without the `z-ai` CLI still get real natural-language answers (with `llm_used: false`).

---

---

## Issue 13: Netlify deployments returning 404 (Page Not Found)

**Symptom:**
After deploying the frontend to Netlify, loading `https://etharasl.netlify.app` resulted in a generic Netlify 404 page.

**Root cause:**
The project is a monorepo with the frontend inside a `frontend/` directory. Next.js App Router relies on a specific build output. Netlify initially failed to detect it as a Next.js project because the `netlify.toml` file was placed inside the `frontend/` subdirectory instead of the root directory. Additionally, without `output: "export"`, Netlify requires specific Next.js runtime plugins which caused conflict.

**Fix:**
1. Moved `netlify.toml` to the root repository folder so Netlify auto-detects the monorepo configuration.
2. Configured `netlify.toml` with `base = "frontend"` and `publish = "out"`.
3. Updated `next.config.ts` to conditionally use `output: "export"` when deployed in production (detected via `process.env.NEXT_PUBLIC_API_URL`).
4. Disabled `rewrites` in `next.config.ts` during static export, as rewrites are not supported in static exports. The frontend now fetches the absolute backend URL directly.

**Files affected:** `netlify.toml` (moved to root), `frontend/next.config.ts`

---

## Issue 14: Render Database Seeding Failure (Circular Dependency)

**Symptom:**
Hitting the `/api/seed-database` endpoint on Render failed silently in the background. A synchronous `/api/seed-debug` endpoint revealed:
```
sqlalchemy.exc.CircularDependencyError: Can't sort tables for DROP; an unresolvable foreign key dependency exists between tables: employees, seats.
```

**Root cause:**
The programmatic seed endpoint called `reset_database()`, which executed `Base.metadata.drop_all(bind=engine)`. Because `Employee` has a foreign key to `Seat` (`seat_id`) and `Seat` has a foreign key to `Employee` (`reserved_for_employee_id`), PostgreSQL could not determine a safe table drop order and crashed.

**Fix:**
1. Since the production database on Render was already fresh and empty, the `DROP TABLE` step was unnecessary.
2. Modified the seed endpoint to skip `reset_database()` and directly use `Base.metadata.create_all()` and the seeding script.
3. Updated the endpoint definition from `@app.post` to `@app.api_route(..., methods=["GET", "POST"])` to allow administrators to easily trigger the seed directly from a browser URL without needing Swagger UI or cURL.

**Files affected:** `backend/app/main.py`

---

## Summary

All 14 issues were caught and fixed via:
- TypeScript strict-mode build checks (`npm run build`)
- Python smoke test script (`scripts/test_endpoints.py`)
- Manual browser testing of each frontend page
- Production debugging on Netlify and Render platforms

No data loss, no security issues, no unrecoverable production incidents.
