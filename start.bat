@echo off
chcp 65001 > nul
title syslog-daemon
echo Starting syslog monitoring service...
node index.js
pause
