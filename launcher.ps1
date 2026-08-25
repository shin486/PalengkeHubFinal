$root = "C:\Users\Jhay-Vy\Downloads\PalengkeHubFinal-main"
$log = "$root\run-logs"
New-Item -ItemType Directory -Force -Path $log | Out-Null

function Start-Svc($label, $cmd, $dir) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c cd /d `"$dir`" && $cmd > `"$log\$label.log`" 2>&1"
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null
    Write-Host "[started] $label"
}

Start-Svc "expo"   'set "CI=true" && npx expo start --port 8081'        "$root\PalengkeHubFinal-main"
Start-Svc "web"    "npm run dev -- --port 5173"                   "$root\web"
Start-Svc "serve"  "set PORT=5174 && node serve.js"              "$root"
Start-Svc "worker" "npx wrangler dev"                            "$root\PalengkeHubFinal-main\supabase-proxy"

Write-Host "Waiting 35s for startup..."
Start-Sleep -Seconds 35

Write-Host "`n=== LOG SUMMARY (last 25 lines each) ==="
foreach ($svc in @("expo","web","serve","worker")) {
    $p = "$log\$svc.log"
    Write-Host "`n----- $svc.log -----"
    if (Test-Path $p) {
        Get-Content $p -Tail 25 | ForEach-Object { "  $_" }
    } else {
        Write-Host "  (no log file)"
    }
}
