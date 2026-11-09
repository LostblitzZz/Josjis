@echo off
chcp 65001 > nul
title Josjis Desktop Daemon
echo [systemd] Initializing stealth desktop services...

:: Launch Node server in the background
start /B node index.js

:: Wait 2 seconds for server to boot
timeout /t 2 > nul

:: Open standalone desktop app window (Compact 440x680, frameless app mode)
start msedge --app=http://localhost:3821 --window-size=440,680 2>nul || start chrome --app=http://localhost:3821 --window-size=440,680 2>nul || start http://localhost:3821

echo ================================================================
echo  Josjis Desktop App is now running!
echo  - Window is compact and can be resized small.
echo  - Auto-dimming turns dark / transparent when mouse leaves.
echo  - Press Esc anytime to toggle fake VS Code.
echo ================================================================
pause
