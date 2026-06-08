@echo off
chcp 65001 >nul
setlocal

set "INDUS_DIR=%~dp0"
cd /d "%INDUS_DIR%"

echo ==========================================
echo  INDUS + InfluxDB — Lancement complet
echo ==========================================
echo.

:: Kill existing processes
echo [1/6] Nettoyage...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul
echo OK.

:: Start InfluxDB
echo [2/6] Demarrage InfluxDB (port 8086)...
set "INFLUX_EXE=%LOCALAPPDATA%\influxdb2\influxd.exe"
if exist "%INFLUX_EXE%" (
  start "" /min "%INFLUX_EXE%"
  timeout /t 4 /nobreak >nul
  echo OK.
) else (
  echo [SKIP] InfluxDB non installe.
)

:: Start OPC-UA
echo [3/6] Demarrage OPC-UA (port 4840)...
start "INDUS-OPCUA" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-opcua-server.js"
timeout /t 3 /nobreak >nul
echo OK.

:: Start Modbus
echo [4/6] Demarrage Modbus (port 502)...
start "INDUS-Modbus" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-modbus-server.js"
timeout /t 2 /nobreak >nul
echo OK.

:: Start Vite
echo [5/6] Demarrage Vite dev server...
start "INDUS-Vite" /min cmd /c "cd /d ""%INDUS_DIR%"" && npx vite"
timeout /t 5 /nobreak >nul
echo OK.

:: Start Electron
echo [6/6] Lancement INDUS Electron...
set "VITE_DEV_SERVER_URL=http://localhost:5173"
start "INDUS-App" /min cmd /c "cd /d ""%INDUS_DIR%"" && npx electron ."
timeout /t 2 /nobreak >nul
echo OK.

echo.
echo ==========================================
echo  Tous les services sont demarres !
echo.
echo  OPC-UA  : opc.tcp://localhost:4840
echo  Modbus  : localhost:502
echo  MQTT    : localhost:1883
echo  InfluxDB: localhost:8086
echo  INDUS   : (fenetre Electron)
echo ==========================================
pause
