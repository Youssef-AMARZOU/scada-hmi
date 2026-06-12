const net = require('net');
const http = require('http');
const { execSync } = require('child_process');

const INDUS_DIR = __dirname + '/..';
const CHECKS = [];

function checkPort(name, host, port, expected = true) {
  CHECKS.push({ name, type: 'port', host, port, expected });
}

function checkHttp(name, url, expectedStatus = 200) {
  CHECKS.push({ name, type: 'http', url, expectedStatus });
}

function checkProcess(name, cmd) {
  CHECKS.push({ name, type: 'process', cmd });
}

// 1 - OPC-UA Server (local)
checkPort('OPC-UA Server', 'localhost', 4840);
// 2 - Modbus Server (local)
checkPort('Modbus Server', 'localhost', 502);
// 3 - MQTT Broker (Mosquitto)
checkPort('MQTT Broker', 'localhost', 1883);
// 4 - InfluxDB
checkHttp('InfluxDB', 'http://localhost:8086/health');
// 5 - Vite Dev Server
checkHttp('Vite Dev Server', 'http://localhost:5173/', [200, 304]);
// 6-11 - Electron services (running inside Node process for the server-side parts)
checkProcess('OPC-UA Client Service', 'node');
checkProcess('Modbus Client Service', 'node');
checkProcess('MQTT Client Service', 'node');
checkProcess('InfluxDB Client Service', 'node');
checkProcess('Simulation Engine', 'node');
checkProcess('Alarm Engine', 'node');

let passed = 0;
let failed = 0;
const results = [];

function testPort(check) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(check.port, check.host);
  });
}

function testHttp(check) {
  return new Promise((resolve) => {
    const req = http.get(check.url, { timeout: 5000 }, (res) => {
      const ok = Array.isArray(check.expectedStatus)
        ? check.expectedStatus.includes(res.statusCode)
        : res.statusCode === check.expectedStatus;
      res.resume();
      resolve(ok);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function testProcess(check) {
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${check.cmd}" /NH`, { encoding: 'utf8', timeout: 3000 });
    return Promise.resolve(out.includes(check.cmd));
  } catch { return Promise.resolve(false); }
}

async function run() {
  console.log('═'.repeat(50));
  console.log('  INDUS — Health Check');
  console.log('═'.repeat(50));
  console.log();

  // Start InfluxDB if not running
  const influxRunning = await testPort({ host: '127.0.0.1', port: 8086 });
  if (!influxRunning) {
    const influxExe = `${process.env.LOCALAPPDATA}\\influxdb2\\influxd.exe`;
    const fs = require('fs');
    if (fs.existsSync(influxExe)) {
      console.log('  Starting InfluxDB...');
      require('child_process').spawn(influxExe, [], { stdio: 'ignore', detached: true });
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  for (const check of CHECKS) {
    let ok;
    if (check.type === 'port') ok = await testPort(check);
    else if (check.type === 'http') ok = await testHttp(check);
    else if (check.type === 'process') ok = await testProcess(check);

    const icon = ok ? '✅' : '❌';
    const status = ok ? 'HEALTHY' : 'DOWN';
    if (ok) passed++; else failed++;
    results.push({ ...check, ok, status });
    console.log(`  ${icon} ${check.name.padEnd(25)} ${status}`);
  }

  console.log();
  console.log('═'.repeat(50));
  console.log(`  Result: ${passed} healthy, ${failed} down`);
  console.log('═'.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

run();
