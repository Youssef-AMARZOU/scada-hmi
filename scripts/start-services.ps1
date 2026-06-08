# INDUS — Start All Services
Write-Host "Starting INDUS infrastructure services..." -ForegroundColor Cyan

# Start Mosquitto
$mosquittoPath = "C:\Program Files\Mosquitto\mosquitto.exe"
if (Test-Path $mosquittoPath) {
    Write-Host "Starting Mosquitto MQTT..." -ForegroundColor Yellow
    Start-Process -FilePath $mosquittoPath -ArgumentList "-v" -WindowStyle Minimized
    Write-Host "  ✓ Mosquitto started on port 1883" -ForegroundColor Green
}

# Start InfluxDB
$influxPath = "$env:LOCALAPPDATA\InfluxDB\influxd.exe"
if (Test-Path $influxPath) {
    Write-Host "Starting InfluxDB..." -ForegroundColor Yellow
    Start-Process -FilePath $influxPath -WindowStyle Minimized
    Write-Host "  ✓ InfluxDB started on port 8086" -ForegroundColor Green
}

Write-Host ""
Write-Host "All services started! Launch the INDUS app with:" -ForegroundColor Green
Write-Host "  cd $PSScriptRoot\.." -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
