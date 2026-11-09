@echo off
title Josjis WhatsApp Pairing Ulang
cd /d "%~dp0"

echo ==========================================================
echo  Josjis WhatsApp Pairing Ulang (Full History Sync)
echo ==========================================================
echo Menghentikan proses backend Node.js lama jika ada...
taskkill /F /IM node.exe >nul 2>&1

echo Menghapus sesi lama agar WhatsApp mengirim seluruh riwayat...
timeout /t 1 /nobreak >nul
if exist "auth\wa_session" (
    rmdir /s /q "auth\wa_session"
)

echo.
echo Memulai koneksi dan menampilkan QR Code...
echo.
node auth-wa.js
echo.
echo Selesai! Kamu sekarang bisa jalankan start.bat
pause
