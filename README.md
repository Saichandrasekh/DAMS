# DAMS — Digital Attendance Management System

Multi-tenant school attendance app. **5 roles** (Super Admin, Admin/Principal,
Teacher, Student, Parent), **~25 React pages**, **126 backend routes**,
production-deployable on Windows.

> 📐 Architecture: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
> 🚀 Deploy guide: [DEPLOY.md](DEPLOY.md)

---

## 🚀 Quick start (fresh laptop, 3 steps)

### Prerequisites (install once)
- **Python 3.9+** — https://www.python.org/downloads/  (tick "Add to PATH" during install)
- **Node.js 18+ LTS** — https://nodejs.org
- **Git** — https://git-scm.com/download/win

### Clone + run

```powershell
# 1) Clone
git clone https://github.com/Saichandrasekh/DAMS.git
cd DAMS

# 2) First-time setup (creates venv, installs everything, ~5 min)
.\setup.ps1

# 3) Run in dev mode (no Nginx needed)
.\dev.ps1
```

That's it. The browser opens **http://localhost:5173/** automatically.

Log in:
- Super Admin: `superadmin@admin.com / admin123`
- (If you said "Y" to demo data during setup) Principal: `principal@smce.edu / smce123`

### Don't want to type? Double-click instead
- **`setup.bat`** — first-time setup
- **`dev.bat`** — run in dev mode
- **`stop.bat`** — stop everything

### If PowerShell blocks the scripts
Run this **once** in PowerShell (your computer settings, only needed first time):
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Type `Y` when prompted. After this, all `.ps1` scripts work.

---

## Project structure

```
d:\attendence\
├── backend/                 Python 3.9 + Flask + Waitress + SQLite
│   ├── app.py               Flask app factory
│   ├── config.py            SECRET_KEY + paths
│   ├── extensions.py        Flask-Limiter singleton
│   ├── run_prod.py          Waitress production launcher
│   ├── backup_db.py         Daily DB backup (run by scheduled task)
│   ├── purge_plaintext_passwords.py  One-shot security migration
│   ├── routes/
│   │   ├── auth.py, superadmin.py, admin.py, teacher.py,
│   │   │   student.py, parent.py        Legacy HTML routes (served at /legacy/*)
│   │   ├── api_auth.py                  /api/v1/auth/*
│   │   ├── api_superadmin.py            /api/v1/superadmin/*
│   │   ├── api_admin.py                 /api/v1/admin/*
│   │   ├── api_teacher.py               /api/v1/teacher/*
│   │   ├── api_student.py               /api/v1/student/*
│   │   └── api_parent.py                /api/v1/parent/*
│   ├── middleware/auth.py   JWT + bcrypt + login_required decorator
│   ├── database/
│   │   ├── db.py            Schema + indexes
│   │   ├── attendance.db    (gitignored)
│   │   └── backups/         (gitignored; populated by backup_db.py)
│   ├── templates/           Legacy Jinja2 templates (still served at /legacy/*)
│   ├── static/              Legacy CSS/JS/uploads
│   ├── requirements.txt
│   └── venv/                (gitignored)
│
├── frontend/                Vite + React 18 + TypeScript
│   ├── src/
│   │   ├── App.tsx          Top-level routes
│   │   ├── main.tsx         Entry point
│   │   ├── api/             Typed API clients per role
│   │   ├── components/      Modal, PageHeader, StatCard, LoadingState, ProtectedRoute, DashboardLayout
│   │   ├── contexts/        AuthContext (JWT in localStorage)
│   │   ├── lib/             axios instance + interceptors
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx        Role-dispatch
│   │   │   ├── superadmin/              SchoolsPage, CredentialsPage, AuditLogsPage, …
│   │   │   ├── admin/                   StudentsPage, TeachersPage, ClassesPage, ExamsPage, TimetablePage, …
│   │   │   ├── teacher/                 MarkAttendancePage, MarksEntryPage, AttendanceReportPage, …
│   │   │   ├── student/                 StudentDashboardPage, StudentAttendancePage, ReportCardPage, …
│   │   │   └── parent/                  ParentDashboardPage
│   │   ├── styles/global.css            Ported design system (Outfit + Inter, glassmorphism)
│   │   └── types/                       Shared TS interfaces per role
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── dist/                Production build output (gitignored)
│
├── deploy.ps1               Build React + (optional) reload Nginx
├── install_services.ps1     Register Nginx + Waitress as Windows services
├── backup_schedule.ps1      Schedule daily DB backup
├── schedule_logs.ps1        Schedule daily log rotation
├── rotate_logs.ps1          Performs the log rotation
├── nginx.conf               Source-of-truth Nginx config (synced to D:\nginx\conf\)
├── .gitignore
├── DEPLOY.md
├── SYSTEM_ARCHITECTURE.md
└── README.md                (this file)
```

---

## Quick start (dev)

```powershell
# Terminal 1 — backend (Flask dev server with auto-reload)
cd d:\attendence\backend
.\venv\Scripts\python.exe app.py
# listens on http://localhost:5000

# Terminal 2 — frontend (Vite dev server with HMR)
cd d:\attendence\frontend
npm install   # first time only
npm run dev
# listens on http://localhost:5173 (proxies /api → :5000)
```

Visit **http://localhost:5173** and log in.

## Production deploy (one-time setup)

```powershell
# 1) Build React + install Windows services + schedule daily tasks (run as Admin)
cd d:\attendence
.\deploy.ps1
.\install_services.ps1
.\backup_schedule.ps1
.\schedule_logs.ps1

# Visit http://localhost/ (Nginx → Waitress → React SPA)
```

After this, **rebooting the machine** brings everything back up automatically.

## Default test credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@admin.com` | `admin123` |
| Admin | `admin_eha@test.com` | `123456` |
| Teacher | `johnson@test.com` | `pass123` |
| Student | `alice@test.com` | `pass123` |

⚠ **Change these immediately in production.**

## Security checklist (already done)

- ✅ Bcrypt password hashing
- ✅ JWT in `Authorization` header, 12 h expiry
- ✅ Rate-limited login (10/min, 100/hr per IP)
- ✅ Plaintext password column wiped — admins use **Reset password** UI now
- ✅ Secret key from env var or gitignored file
- ✅ CORS restricted to known origins
- ✅ SQLite WAL mode with foreign keys ON
- ✅ Multi-tenant scoping via `school_id` on every operational query
- ✅ Daily automated DB backup with 30-day retention
- ✅ Nginx log rotation with 90-day retention
- ✅ Auto-start on reboot via Windows services
- ✅ Auto-restart on crash (NSSM)

## To-do / nice-to-haves

- [ ] Switch DNS for `kautech.co.in` to Cloudflare so the tunnel can route `attend.kautech.co.in`
- [ ] Master timetable read-only view (only legacy page not yet migrated)
- [ ] Forgot-password flow (currently admin-reset only)
- [ ] Lazy-load per-role bundles to shrink first load
- [ ] Sentry / error monitoring for the React app
- [ ] Wipe seed data before serving real users

## License
Proprietary — KAU Tech Services.
