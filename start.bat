@echo off
title Josjis Desktop Launcher
cd /d "%~dp0"

echo ====================================================================
echo               Josjis Stealth Workspace - Native Desktop
echo ====================================================================

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" (
    set CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
)

if not exist "%CSC%" (
    echo [ERROR] csc.exe compiler tidak ditemukan di C:\Windows\Microsoft.NET!
    echo Pastikan .NET Framework terinstal di Windows Anda.
    pause
    exit /b 1
)

echo [1/3] Mengompilasi Josjis.exe dari Josjis.cs...
"%CSC%" /target:winexe /optimize+ /out:Josjis.exe Josjis.cs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal kompilasi Josjis.cs!
    pause
    exit /b 1
)
echo [OK] Josjis.exe siap dijalankan!

echo [2/3] Memeriksa sesi WhatsApp...
if not exist "auth\wa_session\creds.json" (
    echo.
    echo ====================================================================
    echo  [!] WhatsApp belum ditautkan. Menyiapkan QR Code...
    echo ====================================================================
    node auth-wa.js
)

echo [3/3] Memulai Service Backend Hub (Node.js)...
start /B node index.js

timeout /t 2 /nobreak >nul

echo [LAUNCH] Membuka Josjis Native Desktop...
start "" Josjis.exe
