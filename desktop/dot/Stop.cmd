@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy RemoteSigned -File "%~dp0Manage.ps1" -Action Stop
if errorlevel 1 (
  pause
  exit /b 1
)
