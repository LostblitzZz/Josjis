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
    echo [ERROR] Compiler C# (csc.exe) tidak ditemukan di C:\Windows\Microsoft.NET!
    echo Pastikan .NET Framework terinstal di Windows Anda.
    pause
    exit /b 1
)

echo [1/2] Mengompilasi Josjis.exe dari Josjis.cs...
"%CSC%" /target:winexe /optimize+ /out:Josjis.exe Josjis.cs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal mengompilasi Josjis.cs!
    pause
    exit /b 1
)
echo [OK] Josjis.exe siap digunakan!

echo [2/2] Meluncurkan Josjis Native Desktop Hub...
start "" Josjis.exe
exit /b 0
