@echo off
chcp 65001 >nul
setlocal

set "INDUS_DIR=%~dp0"
cd /d "%INDUS_DIR%"

echo ==========================================
echo  INDUS — Demarrage des serveurs locaux
echo ==========================================
echo.

:: Kill any existing node processes
taskkill /F /IM node.exe 2>nul

:: Start both servers in parallel
echo Demarrage OPC-UA (port 4840)...
start "INDUS-OPCUA-Server" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-opcua-server.js"

echo Demarrage Modbus (port 502)...
start "INDUS-Modbus-Server" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-modbus-server.js"

timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo  Serveurs locaux demarres !
echo  OPC-UA :    opc.tcp://localhost:4840
echo  Modbus TCP: localhost:502
echo  MQTT:       localhost:1883 (deja actif)
echo ==========================================
echo.
echo Lancez maintenant : npm run electron:dev
echo.
pause
