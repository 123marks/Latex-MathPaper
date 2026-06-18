@echo off
setlocal
cd /d "%~dp0"
set "PAPER_OS_PORT=3719"
start "" "http://127.0.0.1:%PAPER_OS_PORT%"
node app\server.mjs
endlocal
