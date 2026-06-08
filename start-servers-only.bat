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
echo [1/3] Nettoyage...
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul
echo OK.

:: Start local OPC-UA server
echo [2/3] Demarrage serveur OPC-UA local (port 4840)...
start "INDUS-OPCUA-Server" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-opcua-server.js"
timeout /t 3 /nobreak >nul
echo OK.

:: Start local Modbus TCP server
echo [3/3] Demarrage serveur Modbus TCP local (port 502)...
start "INDUS-Modbus-Server" /min cmd /c "cd /d ""%INDUS_DIR%"" && node scripts\local-modbus-server.js"
timeout /t 2 /nobreak >nul
echo OK.

echo.
echo ==========================================
echo  Serveurs locaux demarres !
echo.
echo  OPC-UA :    opc.tcp://localhost:4840
echo  Modbus TCP: localhost:502
echo  MQTT:       localhost:1883 (deja actif)
echo ==========================================
echo.
echo Lancez maintenant : npm run electron:dev
echo.
pause
