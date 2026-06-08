@echo off
chcp 65001 >nul
setlocal

set "INFLUX_DIR=%~dp0..\..\AppData\Local\influxdb2"
set "INFLUX_EXE=%INFLUX_DIR%\influxd.exe"

echo [InfluxDB] Starting server...
if not exist "%INFLUX_EXE%" (
  echo [InfluxDB] Not found at %INFLUX_EXE%
  echo [InfluxDB] Download from: https://portal.influxdata.com/downloads/
  pause
  exit /b 1
)

start "" /min "%INFLUX_EXE%"
timeout /t 4 /nobreak >nul
echo [InfluxDB] Running on http://localhost:8086
