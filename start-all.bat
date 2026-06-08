@echo off
chcp 65001 >nul
setlocal

set "INDUS_DIR=%~dp0"
cd /d "%INDUS_DIR%"

echo ==========================================
echo  INDUS — Lancement optimise
echo ==========================================
echo.

:: Kill existing processes
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul

:: Start all servers in parallel
echo Demarrage InfluxDB (port 8086)...
set "INFLUX_EXE=%LOCALAPPDATA%\influxdb2\influxd.exe"
if exist "%INFLUX_EXE%" start "" /min "%INFLUX_EXE%"

echo Demarrage OPC-UA (port 4840)...
start "INDUS-OPCUA" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-opcua-server.js"

echo Demarrage Modbus (port 502)...
start "INDUS-Modbus" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-modbus-server.js"

:: Attente courte pour l'initialisation des serveurs
timeout /t 3 /nobreak >nul

:: Mode production (dist/) si disponible, sinon Vite dev
if exist "%INDUS_DIR%dist\index.html" (
  echo Lancement INDUS (mode production)...
  start "INDUS-App" /min cmd /c "cd /d ""%INDUS_DIR%"" && npx electron ."
) else (
  echo Demarrage Vite dev server...
  start "INDUS-Vite" /min cmd /c "cd /d ""%INDUS_DIR%"" && npx vite"
  timeout /t 4 /nobreak >nul
  echo Lancement INDUS (mode dev)...
  set "VITE_DEV_SERVER_URL=http://localhost:5173"
  start "INDUS-App" /min cmd /c "cd /d ""%INDUS_DIR%"" && npx electron ."
)

echo.
echo ==========================================
echo  INDUS en cours de demarrage...
echo  OPC-UA  : opc.tcp://localhost:4840
echo  Modbus  : localhost:502
echo  InfluxDB: localhost:8086
echo ==========================================
pause
