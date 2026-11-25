@echo off
title Josjis Desktop Launcher
cd /d "%~dp0"

echo ====================================================================
echo      Josjis Stealth Workspace - Black Discord Corner Client
echo ====================================================================

if exist "dist\josjis-wa.exe" (
    echo [1/2] Membersihkan proses lama agar bebas bentrok sesi ^(440^)...
    taskkill /F /IM node.exe >nul 2>&1
    echo [2/2] Meluncurkan Josjis Corner Widget ^(Discord Dark + WA^)...
    start "" "dist\josjis-wa.exe"
    exit /b 0
)

echo [ERROR] dist\josjis-wa.exe tidak ditemukan! Jalankan: git pull origin main
pause
exit /b 1
