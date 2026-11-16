@echo off
rem GVS ERP - daily launcher (desktop icon). Starts Docker and the app if needed, then opens it.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0windows\start.ps1"
