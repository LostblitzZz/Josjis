@echo off
chcp 65001 > nul
title journalctl -u ingress-telemetry.service -f
echo [systemd] Initializing systemd-journald telemetry worker...
node index.js
if %errorlevel% neq 0 (
    echo.
    echo [systemd] Process stopped with code %errorlevel%.
)
pause
