# DAMS — Digital Attendance Management System

## Overview
DAMS is a multi-tenant school attendance and academic management system. The
backend exposes a JSON API used by a React single-page app. A legacy Flask
HTML interface is preserved at `/legacy/*` during the migration window.

## Technology stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 18 + TypeScript + React Router 6 + TanStack Query + Axios + SweetAlert2 + react-hook-form |
| Backend | Python 3.9 + Flask 3 + Flask-Limiter + bcrypt + PyJWT |
| DB | SQLite (WAL mode, multi-tenant via `school_id`) |
| Auth | JWT (HS256) in `Authorization: Bearer` header, 12 h expiry |
| Production server | Waitress 3 on port 5000 |
| Reverse proxy + static serving | Nginx 1.26 on port 80 |
| External access (optional) | Cloudflare Tunnel or ngrok |

## Production layout

```
                    Internet (optional Cloudflare Tunnel / ngrok)
                                      │
                                      ▼
   ┌────────────────────────────────────────────────────────────┐
   │   Nginx :80   ─  D:\nginx\  (Windows service: DAMS-Nginx)  │
   │                                                            │
   │   /api/*       →  Waitress :5000                           │
   │   /legacy/*    →  Waitress :5000  (strips /legacy)         │
   │   /static/*    →  d:\attendence\backend\static\            │
   │   /assets/*    →  d:\attendence\frontend\dist\assets       │
   │   /*           →  d:\attendence\frontend\dist\index.html   │
   │                   (SPA fallback)                           │
   └─────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
   ┌────────────────────────────────────────────────────────────┐
   │   Waitress :5000  (Windows service: DAMS-Waitress)         │
   │   Python 3.9 + Flask app                                   │
   │                                                            │
   │   12 blueprints, 126 routes:                               │
   │     - 6 legacy HTML blueprints (auth/superadmin/admin/     │
   │       teacher/student/parent)                              │
   │     - 6 JSON-API blueprints under /api/v1/                 │
   └─────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
                  d:\attendence\backend\database\attendance.db
                          (SQLite, WAL mode, daily backup)
```

## Multi-tenant database design
Every operational table includes `school_id`. The Superadmin scope is the
only one that crosses tenant boundaries (managing schools and their primary
admin accounts).

**Rules:**
1. **Scope every query** with `WHERE school_id = ?`.
2. Indexes: `(school_id, role)`, `(class_id, date)`, `(student_id, date)`.
3. Two-stage delete on students: active record gets archived (`is_active=0`),
   inactive record permanently deleted.

## Auth flow
1. Client `POST /api/v1/auth/login` with `{email, password}`.
2. Server checks bcrypt hash, mints JWT signed with `SECRET_KEY`, returns it.
3. Client stores token in `localStorage` and sends as `Authorization: Bearer …`
   on every subsequent request.
4. Server validates JWT, sets `request.user`, allows route handler to run.
5. Token expires after 12 h — client must re-login.

Login is rate-limited to **10/min and 100/hr per IP**.

## React routing
React Router owns every URL not handled by Nginx's `/api/`, `/legacy/`,
`/static/`, or `/assets/` rules. The dashboard at `/dashboard` dispatches to
the role-specific dashboard component.

## Security hardening
- Bcrypt password hashing (cost factor default).
- Plaintext passwords are **never** stored. Old `original_password` column
  has been wiped; reset-password flow replaces the old reveal-password UI.
- `SECRET_KEY` is read from env var or `backend/.secret_key` file (gitignored).
- Rate-limiter on login + change-password endpoints.
- CORS restricted to `localhost:5173`, `127.0.0.1:5173`,
  `https://attend.kautech.co.in`.
- SQLite WAL mode with `PRAGMA foreign_keys=ON`.

## Operational scripts (project root)

| Script | Purpose |
|---|---|
| `deploy.ps1` | Builds React + (optional) reloads Nginx |
| `install_services.ps1` | One-time: register DAMS-Nginx + DAMS-Waitress Windows services (requires admin) |
| `backup_schedule.ps1` | Schedule daily DB backup at 2 AM |
| `schedule_logs.ps1` | Schedule daily Nginx log rotation at 1 AM |
| `rotate_logs.ps1` | Rotates + gzips Nginx logs (called by the scheduled task) |
| `backend/backup_db.py` | Performs the daily DB backup |
| `backend/purge_plaintext_passwords.py` | One-shot migration: nullify the deprecated `original_password` column |

## Reference
- Deployment guide: [DEPLOY.md](DEPLOY.md)
- Code structure: see [README.md](README.md)
