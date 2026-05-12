# ====================================================================
#   DAMS - One-click start
#   Double-click  start.bat  to run this file.
# ====================================================================
#
# What it does:
#   1) Starts Nginx       (port 80)   if not already running
#   2) Starts Waitress    (port 5000) if not already running
#   3) Optionally starts ngrok        (-Tunnel flag)
#   4) Opens the app in your browser
#
# Usage:
#   .\start.ps1              # local + LAN access only
#   .\start.ps1 -Tunnel      # also start ngrok for internet access
#   .\start.ps1 -NoBrowser   # don't auto-open browser

param(
    [switch]$Tunnel,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$NginxExe   = 'D:\nginx\nginx.exe'
$NginxDir   = 'D:\nginx'
$Python     = 'D:\attendence\backend\venv\Scripts\python.exe'
$RunProd    = 'D:\attendence\backend\run_prod.py'
$BackendDir = 'D:\attendence\backend'
$NgrokExe   = 'D:\ngrok\ngrok.exe'

function Test-Port($port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect('127.0.0.1', $port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

Clear-Host
Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  DAMS - Starting up' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

$publicUrl = $null

# 1) If Windows services exist, just start them
$svcNginx    = Get-Service DAMS-Nginx    -ErrorAction SilentlyContinue
$svcWaitress = Get-Service DAMS-Waitress -ErrorAction SilentlyContinue

if ($svcNginx -and $svcWaitress) {
    Write-Host 'Windows services detected - using them.' -ForegroundColor Green
    if ($svcWaitress.Status -ne 'Running') {
        Write-Host '  starting DAMS-Waitress...' -ForegroundColor Yellow
        Start-Service DAMS-Waitress
    } else {
        Write-Host '  DAMS-Waitress is already running.' -ForegroundColor Gray
    }
    if ($svcNginx.Status -ne 'Running') {
        Write-Host '  starting DAMS-Nginx...' -ForegroundColor Yellow
        Start-Service DAMS-Nginx
    } else {
        Write-Host '  DAMS-Nginx is already running.' -ForegroundColor Gray
    }
} else {
    # 2) No services - start manually

    if (Test-Port 5000) {
        Write-Host 'Waitress is already running on :5000' -ForegroundColor Gray
    } else {
        if (-not (Test-Path $Python))  { throw "Python venv missing: $Python" }
        if (-not (Test-Path $RunProd)) { throw "run_prod.py missing: $RunProd" }
        Write-Host 'Starting Waitress (port 5000)...' -ForegroundColor Yellow
        $waitressCmd = "`$Host.UI.RawUI.WindowTitle = 'DAMS Waitress (port 5000)'; `$env:PYTHONIOENCODING='utf-8'; Set-Location '$BackendDir'; & '$Python' '$RunProd'"
        Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $waitressCmd | Out-Null
        $ok = $false
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Milliseconds 500
            if (Test-Port 5000) { $ok = $true; break }
        }
        if (-not $ok) { throw 'Waitress did not start within 15s - check the Waitress window for errors.' }
        Write-Host '  OK Waitress is listening.' -ForegroundColor Green
    }

    if (Test-Port 80) {
        Write-Host 'Nginx is already running on :80' -ForegroundColor Gray
    } else {
        if (-not (Test-Path $NginxExe)) { throw "Nginx missing: $NginxExe" }
        Write-Host 'Starting Nginx (port 80)...' -ForegroundColor Yellow
        Start-Process -FilePath $NginxExe -WorkingDirectory $NginxDir -WindowStyle Hidden | Out-Null
        $ok = $false
        for ($i = 0; $i -lt 10; $i++) {
            Start-Sleep -Milliseconds 500
            if (Test-Port 80) { $ok = $true; break }
        }
        if (-not $ok) { throw 'Nginx did not start within 5s.' }
        Write-Host '  OK Nginx is listening.' -ForegroundColor Green
    }
}

# 3) Optional ngrok tunnel
if ($Tunnel) {
    if (-not (Test-Path $NgrokExe)) {
        Write-Host "ngrok not found at $NgrokExe - skipping tunnel." -ForegroundColor Yellow
    } else {
        if (Test-Port 4040) {
            Write-Host 'ngrok is already running.' -ForegroundColor Gray
        } else {
            Write-Host 'Starting ngrok tunnel...' -ForegroundColor Yellow
            $ngrokCmd = "`$Host.UI.RawUI.WindowTitle = 'DAMS ngrok tunnel'; & '$NgrokExe' http 80"
            Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $ngrokCmd | Out-Null
            for ($i = 0; $i -lt 20; $i++) {
                Start-Sleep -Milliseconds 500
                if (Test-Port 4040) { break }
            }
        }
        try {
            $api = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
            $tun = $api.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
            if ($tun) { $publicUrl = $tun.public_url }
        } catch { }
    }
}

# 4) Discover the LAN IP
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
    Select-Object -First 1).IPAddress

# 5) Summary
Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host '  DAMS is running' -ForegroundColor Green
Write-Host '========================================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Open in browser:' -ForegroundColor Cyan
Write-Host '  Local       :  http://localhost/' -ForegroundColor White
if ($lanIp) {
    Write-Host "  LAN / Wi-Fi :  http://$lanIp/" -ForegroundColor White
}
if ($publicUrl) {
    Write-Host "  Internet    :  $publicUrl" -ForegroundColor White
}
Write-Host ''
Write-Host 'Login as:' -ForegroundColor Cyan
Write-Host '  super admin :  superadmin@admin.com   /  admin123' -ForegroundColor Gray
Write-Host '  admin       :  admin_eha@test.com     /  123456'   -ForegroundColor Gray
Write-Host '  teacher     :  smith@test.com         /  pass123'  -ForegroundColor Gray
Write-Host '  student     :  alice@test.com         /  pass123'  -ForegroundColor Gray
Write-Host ''
Write-Host 'To stop everything:  .\stop.ps1   (or double-click stop.bat)' -ForegroundColor Yellow
Write-Host ''

if (-not $NoBrowser) {
    Start-Process 'http://localhost/'
}
