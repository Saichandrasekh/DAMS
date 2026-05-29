# AGENTS.md

Guidance for AI coding agents working in this repo. Keep it short; agents load it each session.
This is the **single source of truth** — `CLAUDE.md`, `GEMINI.md`, and
`.github/copilot-instructions.md` all point here. Edit this file, not those.

## What this is
**DAMS** — Digital Attendance Management System. Multi-tenant school app, **5 roles**
(Super Admin, Admin/Principal, Teacher, Student, Parent). Backend: Python 3.9 +
Flask + Waitress + SQLite. Frontend: Vite + React 18 + TypeScript.

Deeper docs (read only when needed — don't load by default):
- [README.md](README.md) — full setup + credentials
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) — architecture
- [DEPLOY.md](DEPLOY.md) — production deploy

## Environment
- **Windows + PowerShell.** Use PowerShell syntax (`$env:VAR`, `$null`, backtick line continuation).
- Backend Python is the **venv at `backend/venv`** (Python 3.9). Always use
  `backend\venv\Scripts\python.exe`, not a global `python`.
- First-time setup: `.\setup.ps1`. Run both servers: `.\dev.ps1`.

## Run in dev (two terminals)
```powershell
# Backend — Flask dev server, http://localhost:5000
cd backend; .\venv\Scripts\python.exe app.py

# Frontend — Vite + HMR, http://localhost:5173 (proxies /api -> :5000)
cd frontend; npm run dev
```
Type-check (no test suite exists): `cd frontend; npm run lint` (`tsc -b --noEmit`).
Build: `npm run build`.

## Where things live
- `backend/app.py` — Flask app factory. `backend/config.py` — secret key + paths.
- `backend/routes/api_*.py` — REST API at **`/api/v1/<role>/*`** (auth, superadmin, admin, teacher, student, parent). The non-`api_` route files are **legacy** HTML served at `/legacy/*` — usually not what you want.
- `backend/middleware/auth.py` — JWT + bcrypt + `login_required` decorator.
- `backend/database/db.py` — schema + indexes. The `.db` file is gitignored.
- `backend/seed_*.py` — seed scripts (run with the venv python).
- `frontend/src/api/<role>.ts` — typed API clients (axios). `frontend/src/types/` — shared TS interfaces.
- `frontend/src/pages/<role>/` — pages. `frontend/src/App.tsx` — route table.
- `frontend/src/contexts/AuthContext.tsx` — JWT stored in localStorage.

## Conventions / gotchas
- **Multi-tenant: every operational query must be scoped by `school_id`.** Forgetting this leaks data across schools.
- API is versioned under `/api/v1/`. Add new endpoints to the matching `api_<role>.py`.
- A frontend feature usually touches 3 layers: `api/<role>.ts` (client) + `types/` (interface) + `pages/<role>/` (UI), and a route in `App.tsx`.
- Auth = JWT in the `Authorization` header (12 h expiry). Passwords are bcrypt-hashed; there is no plaintext password column.
- Excel/PDF exports use `pandas`/`openpyxl`/`reportlab` (already in requirements).

## Workflow for a new contributor
Branch off `main` (`git checkout -b <feature>`), build, push the branch, open a PR.
New modules (new files) are low-risk; edits to shared files (`App.tsx`, `api_admin.py`,
`types/admin.ts`, `db.py`) are where merge conflicts happen — coordinate those.

## Test credentials (dev seed)
- Super Admin: `superadmin@admin.com` / `admin123`
- Admin: `admin_eha@test.com` / `123456`
- Teacher: `johnson@test.com` / `pass123`
- Student: `alice@test.com` / `pass123`
