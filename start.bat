@echo off
chcp 65001 > nul
title worker-telemetry (PID 1824)
node index.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Process stopped with code %errorlevel%.
    pause
)
