# Deployment Notes

This document describes how to deploy the Ethara Seat Allocation & Project Mapping System to production.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Netlify       │  HTTPS  │   Render        │  TCP    │   Render        │
│   (Frontend)    │ ──────> │   (Backend)     │ ──────> │   (PostgreSQL)  │
│   Next.js       │         │   FastAPI       │         │                 │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## Option A: Netlify + Render (Used in Production)

### Step 1: Database (Render Postgres)

1. Create a PostgreSQL database on Render: https://dashboard.render.com/new/database
2. Note the connection credentials — you'll get an **internal connection string** (for the backend running on Render) and an **external connection string** (for local dev).
3. Convert the connection string to SQLAlchemy format:
   - Render gives: `postgres://user:pass@host:port/dbname`
   - SQLAlchemy needs: `postgresql+psycopg2://user:pass@host:port/dbname`

### Step 2: Backend (Render Web Service)

1. Push the `backend/` directory to a GitHub repo (or the whole `ethara/` repo with `backend/` as a subdirectory).
2. On Render, create a new **Web Service** connected to your repo:
3. Render reads `render.yaml` in the repo root and auto-provisions:
   - A PostgreSQL database (`ethara-db`)
   - A Python web service (`ethara-backend`)
4. `DATABASE_URL` is injected automatically via the blueprint — no manual steps needed.
5. To seed the database, call the seed endpoint:
   `GET https://ethara-backend-6ens.onrender.com/api/seed-database`
   (Wait ~30 seconds for background seeding to finish.)

### Step 3: Frontend (Netlify)

1. Push the repository to GitHub.
2. On Netlify, import your GitHub repo.
3. Netlify reads `netlify.toml` at the repo root — no manual settings needed (it sets `base = "frontend"` and `publish = "out"`).
4. Add environment variable in Netlify Dashboard:
   - `NEXT_PUBLIC_API_URL` = `https://<your-backend>.onrender.com` 
     (This tells the frontend to bypass proxy rewrites and use static export pointing directly to the backend).
5. Deploy. Netlify will build the Next.js app as a static export and host it globally.
6. The backend's CORS already allows `*` for demo. For production, restrict it to your Netlify URL.

### Step 4: Verify end-to-end

1. Visit the Netlify URL — dashboard should load with real data.
2. Try the AI Assistant with a query like "How many available seats are there?"
3. Visit `/docs` on the backend URL — Swagger UI should be accessible.

---

## Option B: Railway (Backend + DB) + Netlify (Frontend)

1. Create a Railway project: https://railway.app/new
2. Add a **PostgreSQL** plugin — Railway gives you a `DATABASE_URL` env var.
3. Deploy the backend from your GitHub repo:
   - **Root:** `backend`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add env var: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (Railway interpolates this), but **prepend** `postgresql+psycopg2://` instead of `postgres://`.
4. Deploy the frontend on Netlify (same as Option A).
5. Set `NEXT_PUBLIC_API_URL` to the Railway backend URL.

---

## Option C: Fly.io (Full Stack)

Fly.io can host both backend and a Postgres instance. See https://fly.io/docs/languages-and-frameworks/python/ for Python deployment.

1. `fly launch` in the `backend/` dir
2. `fly postgres create` for the DB
3. `fly secrets set DATABASE_URL=...`
4. `fly deploy`

For the frontend, use Netlify as in Option A.

---

## Environment Variables

### Backend
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (prod) | `sqlite:///./ethara.db` | SQLAlchemy URL. Use `postgresql+psycopg2://` for Postgres. |
| `ZAI_API_KEY` | No | `""` | For the AI Assistant. If absent, the backend falls back to the `z-ai` CLI. |
| `SEED_EMPLOYEES` | No | `5000` | Number of employees to seed |
| `SEED_PROJECTS` | No | `60` | |
| `SEED_FLOORS` | No | `4` | |
| `SEED_BAYS_PER_FLOOR` | No | `8` | |

### Frontend
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `""` (uses proxy) | If set (like on Netlify), the frontend compiles as a static export and calls the backend directly at this URL (e.g., `https://ethara-backend-6ens.onrender.com`). |
| `BACKEND_URL` | No (dev) / Yes (prod node) | `http://localhost:8000` | Used by `next.config.ts` rewrites to know where to proxy `/api/*` requests (only if NEXT_PUBLIC_API_URL is NOT set). |

---

## Important Notes

### AI Assistant on Production
The AI Assistant calls the `z-ai` CLI via `subprocess`. For this to work on Render/Railway:
1. The `z-ai` CLI must be installed in the build step. Add to your build command:
   ```bash
   npm install -g z-ai-web-dev-sdk && pip install -r requirements.txt
   ```
2. Or replace the CLI call in `app/services/ai_assistant.py` with a direct HTTP call to the z-ai API (requires an API key in `ZAI_API_KEY` env var).

If the LLM is unavailable, the AI Assistant endpoint still works — it returns a fallback message instead of an LLM-generated response.

### CORS Configuration
The backend currently allows `*` (all origins) for demo purposes. **For production**, edit `app/core/config.py` and set `BACKEND_CORS_ORIGINS` to your specific frontend URL:

```python
BACKEND_CORS_ORIGINS: list[str] = [
    "https://etharasl.netlify.app",
]
```

### Database Migrations
The app auto-creates tables on startup via `Base.metadata.create_all()`. For production, use Alembic:

```bash
cd backend
pip install alembic
alembic init alembic
# Edit alembic/env.py to use Base.metadata from app.core.database
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

### Free Tier Limitations
- **Render Free:** Backend sleeps after 15 min of inactivity. First request after sleep takes ~30s to wake. Consider the $7/mo Starter tier for an always-on demo.
- **Vercel Free:** 100GB bandwidth/mo, more than enough for a demo.
- **Render Postgres Free:** 90 days free, then deleted. Backup your data or use a paid tier for the long term.

---

## Verification Checklist

After deployment, verify:

- [ ] Backend health check returns 200: `GET https://<backend>/health`
- [ ] Swagger UI accessible: `GET https://<backend>/docs`
- [ ] Dashboard stats endpoint returns real numbers: `GET https://<backend>/api/v1/dashboard/stats`
- [ ] Frontend loads without console errors
- [ ] Dashboard charts render with data
- [ ] Employees page shows 5,000 employees with pagination
- [ ] Seat Map shows colored seats
- [ ] AI Assistant returns a coherent response to "How many available seats are there?"
- [ ] New Joiner auto-allocation works end-to-end (click "Auto-allocate All", verify success message)
