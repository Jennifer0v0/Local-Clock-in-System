@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-production.ps1" %*
exit /b %ERRORLEVEL%