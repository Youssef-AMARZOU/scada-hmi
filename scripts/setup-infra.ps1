# INDUS Platform — Infrastructure Setup
# Run this script as Administrator to install and configure all services.

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  INDUS — Infrastructure Setup            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 1. Mosquitto MQTT Broker
Write-Host "[1/3] Checking Mosquitto MQTT..." -ForegroundColor Yellow
$mosquittoPath = "C:\Program Files\Mosquitto\mosquitto.exe"
if (Test-Path $mosquittoPath) {
    Write-Host "  ✓ Mosquitto installed at $mosquittoPath" -ForegroundColor Green
} else {
    Write-Host "  ✗ Mosquitto not found. Installing..." -ForegroundColor Red
    winget install --id EclipseFoundation.Mosquitto --accept-package-agreements --silent
}

# 2. InfluxDB
Write-Host "[2/3] Checking InfluxDB..." -ForegroundColor Yellow
$influxPath = "$env:LOCALAPPDATA\InfluxDB\influxd.exe"
if (Test-Path $influxPath) {
    Write-Host "  ✓ InfluxDB installed at $influxPath" -ForegroundColor Green
} else {
    Write-Host "  ✗ InfluxDB not found. Download from https://dl.influxdata.com/influxdb/releases/" -ForegroundColor Red
}

# 3. OpenPLC
Write-Host "[3/3] Checking OpenPLC..." -ForegroundColor Yellow
Write-Host "  ℹ OpenPLC Editor can be downloaded from https://autonomylogic.com/" -ForegroundColor Cyan

Write-Host ""
Write-Host "Setup complete! Run start-services.ps1 to launch all services." -ForegroundColor Green
