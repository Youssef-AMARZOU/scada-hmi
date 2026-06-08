const { exec, spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

class ServiceManager {
  constructor() {
    this._processes = {};
  }

  async checkAll() {
    const results = {};
    results.mosquitto = await this._checkPort(1883, 'Mosquitto MQTT');
    results.influxdb = await this._checkPort(8086, 'InfluxDB');
    results.opcua = await this._checkPort(4840, 'OPC-UA');
    results.factoryio = await this._checkHttp('http://localhost:7410/api/tags', 'Factory I/O');
    return results;
  }

  async _checkPort(port, name) {
    let running = false;
    let installed = false;

    // Check if port is open
    running = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { resolve(false); });
      socket.connect(port, 'localhost');
    });

    // Check if service binary exists
    if (port === 1883) {
      installed = fs.existsSync('C:\\Program Files\\Mosquitto\\mosquitto.exe') ||
                  fs.existsSync('C:\\mosquitto\\mosquitto.exe');
    } else if (port === 8086) {
      installed = fs.existsSync(path.join(process.env.LOCALAPPDATA || '', 'InfluxDB', 'influxd.exe')) ||
                  fs.existsSync('C:\\Program Files\\InfluxDB\\influxd.exe') ||
                  fs.existsSync('C:\\ProgramData\\chocolatey\\bin\\influxd.exe');
    } else if (port === 4840) {
      installed = running;
    }

    return { installed, running, port, name };
  }

  async _checkHttp(url, name) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(2000) });
      return { installed: resp.ok, running: resp.ok, name };
    } catch {
      return { installed: false, running: false, name };
    }
  }

  async startAll() {
    const results = {};
    results.mosquitto = await this._startMosquitto();
    results.influxdb = await this._startInfluxDB();
    return results;
  }

  async _startMosquitto() {
    const paths = [
      'C:\\Program Files\\Mosquitto\\mosquitto.exe',
      'C:\\mosquitto\\mosquitto.exe',
    ];
    for (const exe of paths) {
      if (fs.existsSync(exe)) {
        const running = await this._checkPort(1883, 'Mosquitto');
        if (running.running) return { started: false, reason: 'already_running' };
        try {
          const child = spawn(exe, ['-v', '-p', '1883'], { detached: true, stdio: 'ignore', windowsHide: true });
          child.unref();
          await new Promise(r => setTimeout(r, 2000));
          const verify = await this._checkPort(1883, 'Mosquitto');
          return { started: verify.running, pid: child.pid };
        } catch (err) {
          return { started: false, reason: err.message };
        }
      }
    }
    return { started: false, reason: 'not_installed' };
  }

  async _startInfluxDB() {
    const paths = [
      path.join(process.env.LOCALAPPDATA || '', 'InfluxDB', 'influxd.exe'),
      'C:\\Program Files\\InfluxDB\\influxd.exe',
    ];
    for (const exe of paths) {
      if (fs.existsSync(exe)) {
        const running = await this._checkPort(8086, 'InfluxDB');
        if (running.running) return { started: false, reason: 'already_running' };
        try {
          const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: true });
          child.unref();
          await new Promise(r => setTimeout(r, 5000));
          const verify = await this._checkPort(8086, 'InfluxDB');
          return { started: verify.running, pid: child.pid };
        } catch (err) {
          return { started: false, reason: err.message };
        }
      }
    }
    return { started: false, reason: 'not_installed' };
  }
}

module.exports = ServiceManager;