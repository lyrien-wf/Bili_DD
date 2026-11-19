@echo off
rem ===========================================================================
rem  Launcher for the IDM bridge (double-click to run)
rem  It switches to this script's own folder first, so the relative path works
rem  no matter where you launch it from.
rem ===========================================================================
setlocal
cd /d "%~dp0"

where pwsh >nul 2>nul
if not errorlevel 1 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0idm-bridge.ps1" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0idm-bridge.ps1" %*
)

echo.
echo [bridge exited]
pause
