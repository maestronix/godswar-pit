@echo off
rem =============================================================================
rem  Godswar Pit - Doppelklick auf diese Datei, um das Spiel online zu stellen.
rem =============================================================================
cd /d "%~dp0"
title Godswar Pit veröffentlichen
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1"
echo.
pause
