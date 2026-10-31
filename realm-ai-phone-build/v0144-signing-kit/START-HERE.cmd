@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sign-v0144-original-key.ps1"
if errorlevel 1 (
 echo.
 echo SIGNING FAILED. Read the error; do not uninstall the existing app.
 pause
 exit /b 1
)
echo.
echo Same-key signed APK created successfully.
pause
