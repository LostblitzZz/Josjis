@echo off
title Josjis WhatsApp Re-Auth (Full History Sync)
cd /d "%~dp0"

echo ==========================================================
echo  Josjis WhatsApp Pairing Ulang (Full History Sync)
echo ==========================================================
echo Menghapus sesi lama agar WhatsApp mengirim seluruh riwayat...
if exist "auth\wa_session" (
    rmdir /s /q "auth\wa_session"
)
echo Memulai pairing QR Code...
node auth-wa.js
pause
