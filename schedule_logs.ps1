# Register a Windows Scheduled Task that runs rotate_logs.ps1 daily at 1 AM.

param(
    [string]$Time = '01:00',
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'
$taskName = 'DAMS Daily Log Rotation'

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
$script = Join-Path $root 'rotate_logs.ps1'
if (-not (Test-Path $script)) { throw "rotate_logs.ps1 not found at $script" }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Rotate Nginx logs daily for DAMS' -Force | Out-Null

Write-Host ''
Write-Host "OK  scheduled task '$taskName' created at $Time daily" -ForegroundColor Green
Write-Host ''
Write-Host 'To remove later:' -ForegroundColor Cyan
Write-Host '  .\schedule_logs.ps1 -Unregister'
