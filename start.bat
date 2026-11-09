@echo off
chcp 65001 > nul
title journalctl -u ingress-telemetry.service -f
echo [systemd] Initializing systemd-journald telemetry worker...
node index.js
pause
