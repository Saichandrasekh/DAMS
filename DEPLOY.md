# DAMS — Production Deployment

Stack: **Flask + Waitress (port 5000) → Nginx (port 80) → Cloudflare Tunnel → `attend.kautech.co.in`**

The React app is a **static SPA** served by Nginx. The Flask backend handles JSON APIs + legacy HTML routes.

---

## One-time setup

### 1) Install Waitress (already added to `requirements.txt`)
```powershell
cd d:\attendence\backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2) Install Nginx (if not already)
Download Nginx for Windows from https://nginx.org/en/download.html and extract to `C:\nginx\`.

Then either:

**Option A** — Replace the default config:
Copy [nginx.conf](nginx.conf) over `C:\nginx\conf\nginx.conf` (wrap inside `http { ... }` if needed).

**Option B** — Include from the main config:
Add this inside the `http { ... }` block in `C:\nginx\conf\nginx.conf`:
```nginx
include  d:/attendence/nginx.conf;
```

Start Nginx:
```powershell
cd C:\nginx
.\nginx.exe
```

### 3) Cloudflare Tunnel
No change. Keep it pointing at `http://localhost:80`.

---

## Deploy a new version

```powershell
cd d:\attendence
.\deploy.ps1
```

This builds the React app to `frontend/dist/` (~480 KB JS / ~133 KB gzipped).

To also `pip install` / `npm install` first, run with `-Install`:
```powershell
.\deploy.ps1 -Install
```

To validate + reload Nginx automatically:
```powershell
.\deploy.ps1 -ReloadNginx
```

---

## Start the backend (production)

```powershell
cd d:\attendence\backend
.\venv\Scripts\python.exe run_prod.py
```

You should see:
```
============================================================
 DAMS production server (Waitress)
   Listening: http://0.0.0.0:5000
   Threads:   8
   Nginx should reverse-proxy this port.
============================================================
```

Leave this terminal open. For "always on", wrap it in **NSSM** or a Windows service.

---

## Test the deployment

| URL | Should serve |
|---|---|
| `http://localhost/` | React SPA — redirects to `/login` |
| `http://localhost/login` | React login page |
| `http://localhost/api/v1/auth/me` | JSON 401 (no token) |
| `http://localhost/static/css/style.css` | Legacy Flask static |
| `https://attend.kautech.co.in/` | Same via Cloudflare Tunnel |

---

## Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │  Cloudflare Tunnel  →  attend.kautech.co.in             │
   └────────────────────┬────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │   Nginx :80     │
              │                 │
              │  /api/*    ────────►  Waitress :5000
              │  /static/* ────────►  d:/attendence/backend/static/
              │  /superadmin/*, /admin/*, ... (legacy) ──► Waitress :5000
              │  /*        ────────►  d:/attendence/frontend/dist/
              └─────────────────┘                 │
                                                  ▼
                                          Flask app (SQLite)
                                          d:/attendence/backend/database/attendance.db
```

---

## Troubleshooting

**Blank page at `/`?**
Build is missing. Run `.\deploy.ps1`.

**API returns HTML 200 instead of JSON 401?**
Nginx is hitting the legacy route — verify the `/api/` location block is **above** the legacy `/superadmin|/admin|...` block.

**React Router gives 404 on refresh?**
Nginx is missing `try_files $uri $uri/ /index.html;` in the `location /` block.

**`502 Bad Gateway` from `/api/`?**
Waitress isn't running. Start it with `python run_prod.py`.

**Can't edit nginx.conf?**
Stop Nginx first: `.\nginx.exe -s stop`. Edit, then start it again.
