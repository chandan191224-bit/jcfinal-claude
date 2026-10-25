@echo off
title Map Animation Studio
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org ^(LTS^), install it, then run this again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\package.json" (
  echo First start: installing the studio components. This takes a few minutes...
  call npm install
  if errorlevel 1 (
    echo Install failed. See the messages above.
    pause
    exit /b 1
  )
)
node server\server.mjs %*
pause
