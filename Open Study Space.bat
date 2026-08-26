@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-study-space.ps1"

if errorlevel 1 (
  echo.
  echo Study Space could not be opened. Review the message above, then try again.
  pause
)
