# ====================================================================
#   DAMS - One-click stop
#   Double-click  stop.bat  to run this file.
# ====================================================================

$NginxExe = 'D:\nginx\nginx.exe'

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  DAMS - Stopping' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan

$svcNginx    = Get-Service DAMS-Nginx    -ErrorAction SilentlyContinue
$svcWaitress = Get-Service DAMS-Waitress -ErrorAction SilentlyContinue

if ($svcNginx -and $svcNginx.Status -eq 'Running') {
    Write-Host 'Stopping DAMS-Nginx service...' -ForegroundColor Yellow
    Stop-Service DAMS-Nginx
    Write-Host '  OK' -ForegroundColor Green
}
if ($svcWaitress -and $svcWaitress.Status -eq 'Running') {
    Write-Host 'Stopping DAMS-Waitress service...' -ForegroundColor Yellow
    Stop-Service DAMS-Waitress
    Write-Host '  OK' -ForegroundColor Green
}

$nginxProcs = Get-Process nginx -ErrorAction SilentlyContinue
if ($nginxProcs) {
    Write-Host "Stopping Nginx ($($nginxProcs.Count) process)..." -ForegroundColor Yellow
    if (Test-Path $NginxExe) {
        try { & $NginxExe -p (Split-Path $NginxExe) -s stop 2>&1 | Out-Null } catch { }
        Start-Sleep 1
    }
    Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host '  OK' -ForegroundColor Green
}

$pythonProcs = Get-Process python -ErrorAction SilentlyContinue |
    Where-Object { try { $_.Path -like '*attendence\backend\venv*' } catch { $false } }
if ($pythonProcs) {
    Write-Host "Stopping Waitress ($($pythonProcs.Count) process)..." -ForegroundColor Yellow
    $pythonProcs | ForEach-Object { Stop-Process -Id $_.Id -Force }
    Write-Host '  OK' -ForegroundColor Green
}

$ngrokProcs = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcs) {
    Write-Host "Stopping ngrok ($($ngrokProcs.Count) process)..." -ForegroundColor Yellow
    $ngrokProcs | Stop-Process -Force
    Write-Host '  OK' -ForegroundColor Green
}

Write-Host ''
Write-Host 'DAMS is stopped.' -ForegroundColor Green
Write-Host ''
