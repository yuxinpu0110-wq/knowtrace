@echo off
REM ASCII-only launcher. Use this one if the Chinese-named launcher gives
REM trouble on a non-Chinese Windows locale or when called from a script.
REM (Double-clicking the Chinese-named launcher works normally in Explorer.)
setlocal
title KnowTrace Launcher
cd /d "%~dp0"

echo.
echo   KnowTrace - Knowledge Gap Diagnosis
echo   ------------------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js not found.
  echo   Install Node.js 18 or newer: https://nodejs.org/
  echo   Then run this file again. No npm install needed.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p process.versions.node') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 18 (
  echo   [ERROR] Node.js too old, version 18+ required. Current:
  node -v
  echo.
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo   [ERROR] Missing frontend\dist\index.html
  echo   If running from source: cd frontend ^&^& npm install ^&^& npm run build
  echo.
  pause
  exit /b 1
)

echo   Node.js:
node -v
echo   Directory: %CD%
echo.
echo   Starting... the browser will open automatically.
echo.

set KT_AUTO_PORT=1
set KT_OPEN_BROWSER=1

if exist ".env" (
  echo   Loaded .env
  node --env-file=.env "backend\server.js"
) else (
  node "backend\server.js"
)

echo.
echo   [stopped] Press any key to close.
pause >nul
