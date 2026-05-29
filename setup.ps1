# ====================================================================
#   DAMS - First-time setup for a fresh clone
#   Run this once after `git clone`.
# ====================================================================
#
# What it does:
#   1) Verifies Python 3.9+ and Node 18+ are installed
#   2) Creates a Python virtualenv in backend\venv\
#   3) Installs Python dependencies (pip install -r requirements.txt)
#   4) Installs npm dependencies (npm install)
#   5) Initializes an empty SQLite database
#   6) Asks if you want demo data (SMCE college)
#   7) Builds the production React bundle
#
# After this, run:  .\start.ps1    (or double-click start.bat)
#
# Usage:
#   .\setup.ps1               # interactive, asks about demo data
#   .\setup.ps1 -SeedDemo     # auto-seeds SMCE demo data
#   .\setup.ps1 -SkipBuild    # skip the production build

param(
    [switch]$SeedDemo,
    [switch]$SkipDemo,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

function Section($msg) {
    Write-Host ''
    Write-Host '========================================================' -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host '========================================================' -ForegroundColor Cyan
}
function Ok($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  XX  $msg" -ForegroundColor Red; throw $msg }

Clear-Host
Write-Host ''
Write-Host '+------------------------------------------------------+' -ForegroundColor Cyan
Write-Host '|  DAMS - First-time setup                             |' -ForegroundColor Cyan
Write-Host '+------------------------------------------------------+' -ForegroundColor Cyan

# ============================================================
# 1) Check prerequisites
# ============================================================
Section '1/6  Checking prerequisites'

# Python
$python = $null
foreach ($cmd in @('python', 'py -3', 'python3')) {
    try {
        $parts = $cmd -split ' '
        if ($parts.Count -gt 1) {
            $ver = & $parts[0] $parts[1..($parts.Count-1)] --version 2>&1
        } else {
            $ver = & $parts[0] --version 2>&1
        }
        if ($LASTEXITCODE -eq 0 -and $ver -match 'Python (\d+)\.(\d+)') {
            $major = [int]$Matches[1]; $minor = [int]$Matches[2]
            if ($major -eq 3 -and $minor -ge 9) {
                $python = $cmd
                Ok "Python found: $ver  ($cmd)"
                break
            }
        }
    } catch { }
}
if (-not $python) {
    Fail "Python 3.9+ not found. Install from https://www.python.org/downloads/ and re-run."
}

# Node
try {
    $nodeVer = node --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $nodeVer -match 'v(\d+)') {
        $major = [int]$Matches[1]
        if ($major -lt 18) { Fail "Node $nodeVer is too old. Install Node 18+ from https://nodejs.org" }
        Ok "Node found: $nodeVer"
    } else { Fail "Node not found" }
} catch {
    Fail "Node not found. Install from https://nodejs.org and re-run."
}

# Git (just informational)
try {
    $gitVer = git --version 2>&1
    if ($LASTEXITCODE -eq 0) { Ok "Git found: $gitVer" }
} catch { Warn 'Git not on PATH (only needed for git pull / push)' }

# ============================================================
# 2) Python virtualenv
# ============================================================
Section '2/6  Creating Python virtualenv'

$venv = Join-Path $backend 'venv'
$venvPy = Join-Path $venv 'Scripts\python.exe'

if (Test-Path $venvPy) {
    Ok "venv already exists at backend\venv\"
} else {
    Write-Host '  Creating venv...'
    $parts = $python -split ' '
    if ($parts.Count -gt 1) {
        & $parts[0] $parts[1..($parts.Count-1)] -m venv $venv
    } else {
        & $parts[0] -m venv $venv
    }
    if (-not (Test-Path $venvPy)) { Fail 'venv creation failed' }
    Ok 'venv created'
}

# ============================================================
# 3) Python dependencies
# ============================================================
Section '3/6  Installing Python packages (this can take 1-3 minutes)'

& $venvPy -m pip install --upgrade pip --quiet 2>&1 | Out-Null
$reqFile = Join-Path $backend 'requirements.txt'
if (-not (Test-Path $reqFile)) { Fail "requirements.txt missing at $reqFile" }
& $venvPy -m pip install -r $reqFile --quiet
if ($LASTEXITCODE -ne 0) { Fail 'pip install failed' }
Ok 'Python dependencies installed'

# ============================================================
# 4) Node dependencies
# ============================================================
Section '4/6  Installing Node packages (this can take 2-5 minutes)'

Push-Location $frontend
try {
    npm install --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { Fail 'npm install failed' }
} finally { Pop-Location }
Ok 'Node dependencies installed'

# ============================================================
# 5) Initialize empty database + ask about demo data
# ============================================================
Section '5/6  Initializing database'

$env:PYTHONIOENCODING = 'utf-8'
Push-Location $backend
try {
    & $venvPy -c "from database.db import init_db; init_db()"
    if ($LASTEXITCODE -ne 0) { Fail 'init_db failed' }
    Ok 'attendance.db ready'

    # Always create a super-admin so you can log in
    & $venvPy seed_superadmin.py 2>&1 | Out-Null
    Ok 'super-admin seeded  (superadmin@admin.com / admin123)'

    # Demo data
    $wantDemo = $false
    if ($SeedDemo) {
        $wantDemo = $true
    } elseif (-not $SkipDemo) {
        Write-Host ''
        Write-Host '  Seed demo data for Sri Mittapalli College of Engineering?' -ForegroundColor Yellow
        Write-Host '  This creates 400 students, 32 faculty, 14 days of attendance, marks.'
        $ans = Read-Host '  Type Y to seed [y/N]'
        if ($ans -match '^[Yy]') { $wantDemo = $true }
    }
    if ($wantDemo) {
        Write-Host '  Seeding demo data (about 30s)...'
        & $venvPy seed_smce.py 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Ok 'Demo data ready  (principal@smce.edu / smce123)'
        } else {
            Warn 'demo seed reported issues - check seed_smce.py manually'
        }
    } else {
        Write-Host '  Skipped demo data. To seed later: cd backend; .\venv\Scripts\python.exe seed_smce.py' -ForegroundColor Gray
    }
} finally { Pop-Location }

# ============================================================
# 6) Build the production React bundle
# ============================================================
if ($SkipBuild) {
    Section '6/6  Skipped production build (-SkipBuild)'
} else {
    Section '6/6  Building production React bundle'
    Push-Location $frontend
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { Fail 'frontend build failed' }
    } finally { Pop-Location }
    Ok 'Production bundle ready in frontend\dist\'
}

# ============================================================
# Done
# ============================================================
Write-Host ''
Write-Host '+------------------------------------------------------+' -ForegroundColor Green
Write-Host '|  Setup complete!                                     |' -ForegroundColor Green
Write-Host '+------------------------------------------------------+' -ForegroundColor Green
Write-Host ''
Write-Host 'To run DAMS now:' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Dev mode (auto-reload, recommended for editing):' -ForegroundColor Yellow
Write-Host '    .\dev.ps1' -ForegroundColor White
Write-Host '    -> open http://localhost:5173/' -ForegroundColor Gray
Write-Host ''
Write-Host '  Production mode (needs Nginx installed separately):' -ForegroundColor Yellow
Write-Host '    .\start.ps1' -ForegroundColor White
Write-Host '    -> open http://localhost/' -ForegroundColor Gray
Write-Host ''
Write-Host 'Login (super admin):  superadmin@admin.com / admin123' -ForegroundColor Cyan
if ($wantDemo) {
    Write-Host 'Login (SMCE demo):    principal@smce.edu / smce123' -ForegroundColor Cyan
}
Write-Host ''
