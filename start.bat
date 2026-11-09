@echo off
chcp 65001 > nul
title journalctl -u ingress-telemetry.service -f
echo [systemd] Initializing systemd-journald telemetry worker...
echo Opening stealth Web UI at http://localhost:3821 ...
timeout /t 2 > nul
start http://localhost:3821
node index.js
if %errorlevel% neq 0 (
    echo.
    echo [systemd] Process stopped with code %errorlevel%.
)
pause
