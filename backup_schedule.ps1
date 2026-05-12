# Register a Windows Scheduled Task that runs backup_db.py daily at 2 AM.
# One-time setup. Run from project root as Administrator (or current user — script falls back to user scope).
#
# Usage:
#   .\backup_schedule.ps1
#   .\backup_schedule.ps1 -Time 03:00      # different time
#   .\backup_schedule.ps1 -Unregister      # remove

param(
    [string]$Time = '02:00',
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'
$taskName = 'DAMS Daily DB Backup'

if ($Unregister) {
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "OK  removed task '$taskName'" -ForegroundColor Green
    } catch {
        Write-Host "WARN  task not found: $taskName" -ForegroundColor Yellow
    }
    exit 0
}

$root = $PSScriptRoot
$python = Join-Path $root 'backend\venv\Scripts\python.exe'
$script = Join-Path $root 'backend\backup_db.py'

if (-not (Test-Path $python)) { throw "Python venv not found at $python" }
if (-not (Test-Path $script)) { throw "backup_db.py not found at $script" }

$action = New-ScheduledTaskAction -Execute $python -Argument "`"$script`"" -WorkingDirectory (Split-Path $script)
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Daily backup of attendance.db (DAMS)' -Force | Out-Null

Write-Host ''
Write-Host "OK  scheduled task '$taskName' created" -ForegroundColor Green
Write-Host "    Runs daily at $Time"
Write-Host "    Script: $script"
Write-Host ''
Write-Host 'To run it once now (verify it works):' -ForegroundColor Cyan
Write-Host "  & '$python' '$script'"
Write-Host ''
Write-Host 'To remove later:' -ForegroundColor Cyan
Write-Host '  .\backup_schedule.ps1 -Unregister'
