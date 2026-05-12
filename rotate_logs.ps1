# Rotate Nginx logs daily — keep the last 14 days, gzip the rest, delete after 90 days.
# Designed to run from a Windows scheduled task (see schedule_logs.ps1 to install).

param(
    [string]$NginxDir = 'D:\nginx',
    [string]$NginxExe = 'D:\nginx\nginx.exe',
    [int]$KeepUncompressedDays = 14,
    [int]$DeleteAfterDays = 90
)

$ErrorActionPreference = 'Continue'
$logsDir = Join-Path $NginxDir 'logs'
$today = Get-Date -Format 'yyyy-MM-dd'

if (-not (Test-Path $logsDir)) {
    Write-Host "WARN  $logsDir not found, skipping" -ForegroundColor Yellow
    exit 0
}

# Rotate access.log and error.log by renaming with today's date
foreach ($logName in @('access.log', 'error.log')) {
    $live = Join-Path $logsDir $logName
    if (-not (Test-Path $live) -or (Get-Item $live).Length -eq 0) { continue }
    $archived = Join-Path $logsDir "$logName.$today"
    if (Test-Path $archived) {
        $archived = Join-Path $logsDir "$logName.$today.$([DateTime]::Now.ToString('HHmmss'))"
    }
    try {
        Move-Item $live $archived -Force
        New-Item -ItemType File -Path $live -Force | Out-Null
        Write-Host "OK  rotated $logName -> $(Split-Path $archived -Leaf)" -ForegroundColor Green
    } catch {
        Write-Host "WARN  could not rotate $logName: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Tell Nginx to reopen log files (no downtime)
if (Test-Path $NginxExe) {
    & $NginxExe -p $NginxDir -s reopen 2>&1 | Out-Null
}

# Gzip files older than KeepUncompressedDays
$gzipCutoff = (Get-Date).AddDays(-$KeepUncompressedDays)
Get-ChildItem $logsDir -File | Where-Object {
    ($_.Name -match '^(access|error)\.log\.') -and -not $_.Name.EndsWith('.gz') -and $_.LastWriteTime -lt $gzipCutoff
} | ForEach-Object {
    $src = $_.FullName
    $dst = "$src.gz"
    try {
        $inStream = [IO.File]::OpenRead($src)
        $outStream = [IO.File]::Create($dst)
        $gz = New-Object IO.Compression.GZipStream($outStream, [IO.Compression.CompressionLevel]::Optimal)
        $inStream.CopyTo($gz)
        $gz.Close(); $outStream.Close(); $inStream.Close()
        Remove-Item $src -Force
        Write-Host "GZ   compressed $($_.Name) -> $(Split-Path $dst -Leaf)" -ForegroundColor Cyan
    } catch {
        Write-Host "WARN  gzip failed for $($_.Name): $($_.Exception.Message)" -ForegroundColor Yellow
        if (Test-Path $dst) { Remove-Item $dst -Force -ErrorAction SilentlyContinue }
    }
}

# Delete logs older than DeleteAfterDays
$deleteCutoff = (Get-Date).AddDays(-$DeleteAfterDays)
$deleted = 0
Get-ChildItem $logsDir -File | Where-Object {
    ($_.Name -match '^(access|error)\.log\.') -and $_.LastWriteTime -lt $deleteCutoff
} | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    $deleted++
}
if ($deleted -gt 0) { Write-Host "PURGE  deleted $deleted log(s) older than $DeleteAfterDays days" -ForegroundColor Magenta }

Write-Host "DONE  log rotation complete" -ForegroundColor Green
