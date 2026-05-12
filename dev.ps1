# ====================================================================
#   DAMS - Dev mode (Flask + Vite, no Nginx needed)
# ====================================================================
#
# Runs Flask backend with auto-reload + Vite dev server with HMR.
# Open  http://localhost:5173/  in your browser.
#
# Best for editing code on a fresh laptop without installing Nginx.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvPy   = Join-Path $backend 'venv\Scripts\python.exe'

if (-not (Test-Path $venvPy)) {
    Write-Host 'venv not found - run .\setup.ps1 first' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Host 'node_modules not found - run .\setup.ps1 first' -ForegroundColor Red
    exit 1
}

function Test-Port($p) {
    try { $t = New-Object System.Net.Sockets.TcpClient; $t.Connect('127.0.0.1', $p); $t.Close(); return $true }
    catch { return $false }
}

Clear-Host
Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  DAMS - Dev mode' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

# Backend (Flask debug server on :5000)
if (Test-Port 5000) {
    Write-Host 'Something is already on :5000 - skipping backend start.' -ForegroundColor Yellow
} else {
    Write-Host 'Starting Flask backend (port 5000)...' -ForegroundColor Yellow
    $cmd = "`$Host.UI.RawUI.WindowTitle='DAMS Flask dev (port 5000)'; `$env:PYTHONIOENCODING='utf-8'; Set-Location '$backend'; & '$venvPy' app.py"
    Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $cmd | Out-Null
    for ($i = 0; $i -lt 30; $i++) { if (Test-Port 5000) { break }; Start-Sleep -Milliseconds 500 }
    if (Test-Port 5000) { Write-Host '  OK Flask is up' -ForegroundColor Green } else { Write-Host '  Flask may still be loading, check the Flask window' -ForegroundColor Yellow }
}

# Frontend (Vite on :5173)
if (Test-Port 5173) {
    Write-Host 'Something is already on :5173 - skipping Vite start.' -ForegroundColor Yellow
} else {
    Write-Host 'Starting Vite dev server (port 5173)...' -ForegroundColor Yellow
    $cmd = "`$Host.UI.RawUI.WindowTitle='DAMS Vite dev (port 5173)'; Set-Location '$frontend'; npm run dev"
    Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $cmd | Out-Null
    for ($i = 0; $i -lt 30; $i++) { if (Test-Port 5173) { break }; Start-Sleep -Milliseconds 500 }
    if (Test-Port 5173) { Write-Host '  OK Vite is up' -ForegroundColor Green } else { Write-Host '  Vite may still be loading, check the Vite window' -ForegroundColor Yellow }
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host '  DAMS dev is running' -ForegroundColor Green
Write-Host '========================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Open in browser:  http://localhost:5173/' -ForegroundColor White
Write-Host ''
Write-Host '  Two terminal windows are open showing live logs.' -ForegroundColor Gray
Write-Host '  Edit code -> auto-refresh in browser.' -ForegroundColor Gray
Write-Host ''
Write-Host '  Login:  superadmin@admin.com / admin123' -ForegroundColor Cyan
Write-Host ''
Write-Host '  To stop:  close both terminal windows  (or run .\stop.ps1)' -ForegroundColor Yellow
Write-Host ''

Start-Process 'http://localhost:5173/'
