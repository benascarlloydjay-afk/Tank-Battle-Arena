@echo off
title Tank Battle Arena PHP Room Service
"%~dp0..\..\php\php.exe" "%~dp0websocket-server.php"
if errorlevel 1 pause
