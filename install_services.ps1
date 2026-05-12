# Register Nginx + Waitress as Windows services so they auto-start on boot
# and restart automatically on crash.
#
# Requires Administrator. Right-click PowerShell -> "Run as administrator", then:
#     cd d:\attendence
#     .\install_services.ps1
#
# To remove later:
#     .\install_services.ps1 -Uninstall

param(
    [switch]$Uninstall,
    [string]$NssmPath = 'D:\nssm\nssm-2.24\win64\nssm.exe',
    [string]$NginxExe = 'D:\nginx\nginx.exe',
    [string]$NginxDir = 'D:\nginx',
    [string]$Python   = 'D:\attendence\backend\venv\Scripts\python.exe',
    [string]$RunProd  = 'D:\attendence\backend\run_prod.py',
    [string]$BackendDir = 'D:\attendence\backend'
)

$ErrorActionPreference = 'Stop'

# Elevation check
$current = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'ERROR  This script must run as Administrator.' -ForegroundColor Red
    Write-Host '       Right-click PowerShell -> Run as administrator, then re-run.' -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $NssmPath)) { throw "NSSM not found at $NssmPath" }
if (-not $Uninstall) {
    if (-not (Test-Path $NginxExe)) { throw "Nginx not found at $NginxExe" }
    if (-not (Test-Path $Python))   { throw "Python venv not found at $Python" }
    if (-not (Test-Path $RunProd))  { throw "run_prod.py not found at $RunProd" }
}

$nginxSvc    = 'DAMS-Nginx'
$waitressSvc = 'DAMS-Waitress'

function Service-Exists($name) {
    return (Get-Service -Name $name -ErrorAction SilentlyContinue) -ne $null
}

if ($Uninstall) {
    foreach ($svc in @($nginxSvc, $waitressSvc)) {
        if (Service-Exists $svc) {
            Write-Host "Stopping + removing $svc..." -ForegroundColor Yellow
            & $NssmPath stop $svc | Out-Null
            & $NssmPath remove $svc confirm | Out-Null
            Write-Host "  removed" -ForegroundColor Green
        } else {
            Write-Host "$svc not installed" -ForegroundColor Gray
        }
    }
    exit 0
}

# Stop existing instances so we don't conflict with services we're about to install
Write-Host 'Stopping any running nginx/python processes that might conflict...' -ForegroundColor Yellow
Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$pythonPids = (Get-Process python -ErrorAction SilentlyContinue) | Where-Object { try { $_.Path -eq $Python } catch { $false } }
$pythonPids | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
Start-Sleep 1

# ─── 1) Waitress service ──────────────────────────────────────────
if (Service-Exists $waitressSvc) {
    Write-Host "$waitressSvc already exists, removing..." -ForegroundColor Yellow
    & $NssmPath stop $waitressSvc | Out-Null
    & $NssmPath remove $waitressSvc confirm | Out-Null
}
Write-Host "Installing $waitressSvc..." -ForegroundColor Yellow
& $NssmPath install $waitressSvc $Python $RunProd
& $NssmPath set $waitressSvc AppDirectory $BackendDir
& $NssmPath set $waitressSvc AppStdout "$BackendDir\logs\waitress.out.log"
& $NssmPath set $waitressSvc AppStderr "$BackendDir\logs\waitress.err.log"
& $NssmPath set $waitressSvc AppRotateFiles 1
& $NssmPath set $waitressSvc AppRotateBytes 10485760  # 10 MB
& $NssmPath set $waitressSvc AppEnvironmentExtra "PYTHONIOENCODING=utf-8"
& $NssmPath set $waitressSvc DisplayName 'DAMS Waitress (Flask API)'
& $NssmPath set $waitressSvc Description 'DAMS production Flask backend on port 5000'
& $NssmPath set $waitressSvc Start SERVICE_AUTO_START
& $NssmPath set $waitressSvc AppExit Default Restart
& $NssmPath set $waitressSvc AppRestartDelay 5000
New-Item -ItemType Directory -Path "$BackendDir\logs" -Force | Out-Null
Write-Host "  OK $waitressSvc installed" -ForegroundColor Green

# ─── 2) Nginx service ─────────────────────────────────────────────
if (Service-Exists $nginxSvc) {
    Write-Host "$nginxSvc already exists, removing..." -ForegroundColor Yellow
    & $NssmPath stop $nginxSvc | Out-Null
    & $NssmPath remove $nginxSvc confirm | Out-Null
}
Write-Host "Installing $nginxSvc..." -ForegroundColor Yellow
& $NssmPath install $nginxSvc $NginxExe
& $NssmPath set $nginxSvc AppDirectory $NginxDir
& $NssmPath set $nginxSvc AppStdout "$NginxDir\logs\service.out.log"
& $NssmPath set $nginxSvc AppStderr "$NginxDir\logs\service.err.log"
& $NssmPath set $nginxSvc AppStopMethodConsole 5000
& $NssmPath set $nginxSvc AppStopMethodWindow 5000
& $NssmPath set $nginxSvc AppStopMethodThreads 5000
& $NssmPath set $nginxSvc DisplayName 'DAMS Nginx (Reverse proxy)'
& $NssmPath set $nginxSvc Description 'DAMS production Nginx on port 80'
& $NssmPath set $nginxSvc Start SERVICE_AUTO_START
& $NssmPath set $nginxSvc DependOnService $waitressSvc
& $NssmPath set $nginxSvc AppExit Default Restart
& $NssmPath set $nginxSvc AppRestartDelay 5000
Write-Host "  OK $nginxSvc installed (depends on $waitressSvc)" -ForegroundColor Green

# Start services
Write-Host ''
Write-Host 'Starting services...' -ForegroundColor Yellow
Start-Service $waitressSvc
Start-Service $nginxSvc
Start-Sleep 2

Get-Service $waitressSvc, $nginxSvc | Format-Table Name, Status, StartType -AutoSize

Write-Host ''
Write-Host 'OK  Both services installed and running.' -ForegroundColor Green
Write-Host '    They will start automatically on every reboot.' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Test:  http://localhost/'
Write-Host ''
Write-Host 'Manage services:' -ForegroundColor Cyan
Write-Host "  Get-Service DAMS-*"
Write-Host "  Restart-Service DAMS-Waitress"
Write-Host "  Restart-Service DAMS-Nginx"
Write-Host "  Stop-Service DAMS-Nginx, DAMS-Waitress"
Write-Host ''
Write-Host 'Logs:' -ForegroundColor Cyan
Write-Host "  Get-Content $BackendDir\logs\waitress.err.log -Tail 50"
Write-Host "  Get-Content $NginxDir\logs\error.log -Tail 50"
