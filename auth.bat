@echo off
chcp 65001 > nul
title Josjis - WhatsApp Linker
cd /d "%~dp0"
echo ==================================================
echo   Josjis - WhatsApp Terminal Pairing Helper
echo ==================================================
echo Menghentikan proses Node lama agar tidak bentrok sesi (440)...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
node auth-wa.js
pause
