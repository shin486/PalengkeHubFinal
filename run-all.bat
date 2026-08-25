@echo off
REM ============================================================
REM PalengkeHub launcher — starts all 4 services detached.
REM Uses PowerShell/.NET ProcessStartInfo (launcher.ps1) which is
REM the reliable detached-launch method on this machine.
REM Each service writes to its own log under run-logs\.
REM ============================================================
setlocal
set "ROOT=C:\Users\Jhay-Vy\Downloads\PalengkeHubFinal-main"
set "LOG=%ROOT%\run-logs"
mkdir "%LOG%" 2>nul

echo ============================================================
echo PalengkeHub - launching all 4 services (detached, logged to %LOG%)
echo   8081  Expo (Metro)
echo   5173  Web admin  (Vite)
echo   5174  Local static server (serve.js)
echo   8787  Cloudflare Worker (supabase-proxy)
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\launcher.ps1"
endlocal
