$ErrorActionPreference = 'Continue'
Write-Host '=== Process info for PID 61296 ==='
Get-Process -Id 61296 -ErrorAction SilentlyContinue | Format-List Id, ProcessName, Path, StartTime
if (-not $?) { Write-Host 'Process 61296 not found by Get-Process' }

Write-Host '=== netstat for 8081 ==='
& netstat -ano | Select-String ':8081'

Write-Host '=== Excluded TCP port ranges (Hyper-V/WSL reservations) ==='
& netsh int ipv4 show excludedportrange protocol=tcp

Write-Host '=== Stop-Process attempt with error shown ==='
try {
  Stop-Process -Id 61296 -Force -ErrorAction Stop
  Write-Host 'Stop-Process succeeded'
} catch {
  Write-Host ("Stop-Process FAILED: {0}" -f $_.Exception.Message)
}

Start-Sleep -Seconds 2
$still = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($still) { Write-Host 'Port 8081 STILL busy after all attempts' } else { Write-Host 'Port 8081 now FREE' }
