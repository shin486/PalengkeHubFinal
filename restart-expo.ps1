$ErrorActionPreference = 'Continue'
$appDir = 'C:\Users\Jhay-Vy\Downloads\PalengkeHubFinal-main\PalengkeHubFinal-main'
$logDir = 'C:\Users\Jhay-Vy\Downloads\PalengkeHubFinal-main\run-logs'

# Kill ALL listeners on 8081, repeatedly until free
for ($attempt = 1; $attempt -le 5; $attempt++) {
  $conns = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) { break }
  foreach ($c in $conns) {
    $pidToKill = $c.OwningProcess
    $pname = (Get-Process -Id $pidToKill -ErrorAction SilentlyContinue).ProcessName
    Write-Host ("Attempt {0}: killing PID {1} ({2})" -f $attempt, $pidToKill, $pname)
    & taskkill /F /T /PID $pidToKill 2>$null | Out-Null
  }
  Start-Sleep -Seconds 3
}

$still = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($still) {
  Write-Host 'WARNING: port 8081 STILL busy:'
  $still | ForEach-Object { "  PID $($_.OwningProcess)" }
} else {
  Write-Host 'Port 8081 is free.'
}

# Relaunch Expo
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'cmd.exe'
$psi.Arguments = '/c cd /d "' + $appDir + '" && set "CI=true" && npx expo start --port 8081 > "' + $logDir + '\expo.log" 2>&1'
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
[System.Diagnostics.Process]::Start($psi) | Out-Null
Write-Host '[started] expo'

Write-Host 'Waiting up to 90s for Metro...'
$ready = $false
for ($i = 0; $i -lt 18; $i++) {
  Start-Sleep -Seconds 5
  if (Test-Path "$logDir\expo.log") {
    $tail = Get-Content "$logDir\expo.log" -Tail 15 -ErrorAction SilentlyContinue
    if (($tail -match 'Metro waiting') -or ($tail -match 'Web is waiting') -or ($tail -match 'localhost:8081')) { $ready = $true; break }
  }
}
Write-Host ''
Write-Host '=== expo.log (last 25 lines) ==='
Get-Content "$logDir\expo.log" -Tail 25 -ErrorAction SilentlyContinue | ForEach-Object { "  $_" }
if ($ready) { Write-Host 'METRO IS READY' } else { Write-Host 'Metro not confirmed yet.' }
