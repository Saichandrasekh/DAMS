# DAMS one-shot production deploy script
# Run from project root:  .\deploy.ps1
#
# Flags:
#   -Install       also run pip + npm install first
#   -ReloadNginx   validate + reload nginx after build
#   -NginxPath     path to nginx.exe (default: C:\nginx\nginx.exe)

param(
    [switch]$Install,
    [switch]$ReloadNginx,
    [string]$NginxPath = 'C:\nginx\nginx.exe'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  DAMS production deploy' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan

if ($Install) {
    Write-Host ''
    Write-Host '[1/3] Installing backend deps...' -ForegroundColor Yellow
    & "$root\backend\venv\Scripts\python.exe" -m pip install -r "$root\backend\requirements.txt" --quiet
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }

    Write-Host '[2/3] Installing frontend deps...' -ForegroundColor Yellow
    Push-Location "$root\frontend"
    npm install --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install failed' }
    Pop-Location
}

Write-Host ''
Write-Host '[3/3] Building React frontend (Vite)...' -ForegroundColor Yellow
Push-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'frontend build failed' }
Pop-Location

$distBytes = (Get-ChildItem "$root\frontend\dist" -Recurse -File | Measure-Object -Property Length -Sum).Sum
$distKb = [Math]::Round($distBytes / 1KB, 0)
Write-Host ''
Write-Host "OK  built dist/  ($distKb KB total)" -ForegroundColor Green

if ($ReloadNginx) {
    if (-not (Test-Path $NginxPath)) {
        Write-Host "WARN  Nginx not found at $NginxPath - skipping reload." -ForegroundColor Yellow
    } else {
        Write-Host ''
        Write-Host 'Testing nginx config...' -ForegroundColor Yellow
        & $NginxPath -t
        if ($LASTEXITCODE -eq 0) {
            Write-Host 'Reloading nginx...' -ForegroundColor Yellow
            & $NginxPath -s reload
            Write-Host 'OK  Nginx reloaded' -ForegroundColor Green
        } else {
            throw 'nginx -t failed - check the config'
        }
    }
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  Next steps' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '1) Start the backend (production):' -ForegroundColor Gray
Write-Host "     cd $root\backend" -ForegroundColor White
Write-Host '     .\venv\Scripts\python.exe run_prod.py' -ForegroundColor White
Write-Host ''
Write-Host '2) Make sure Nginx is running and proxying to :5000.' -ForegroundColor Gray
Write-Host '   (See nginx.conf at the project root.)' -ForegroundColor Gray
Write-Host ''
Write-Host '3) Cloudflare Tunnel keeps pointing at Nginx - no change.' -ForegroundColor Gray
Write-Host ''
Write-Host 'Visit:  https://attend.kautech.co.in  (or http://localhost/)' -ForegroundColor Cyan
