@echo off
chcp 65001 > nul
title worker-telemetry (PID 1824)
cd /d "%~dp0"
taskkill /F /IM node.exe >nul 2>&1
node index.js --cli
pause
