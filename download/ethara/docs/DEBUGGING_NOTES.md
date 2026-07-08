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

## Summary

All 9 issues were caught during development (not in production) via:
- TypeScript strict-mode build checks (`npm run build`)
- Python smoke test script (`scripts/test_endpoints.py`)
- Manual browser testing of each frontend page
- End-to-end screenshot capture via `agent-browser`

No data loss, no security issues, no production incidents.
