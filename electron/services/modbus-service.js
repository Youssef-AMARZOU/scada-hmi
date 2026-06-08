/**
 * Modbus TCP Client Service for INDUS
 * Connects to Modbus TCP servers (local simulators or PLCs)
 * Reads holding registers and coils, exposes as tags
 */

const EventEmitter = require('events');
const net = require('net');

class ModbusService extends EventEmitter {
  constructor() {
    super();
    this._socket = null;
    this._client = null;
    this._connected = false;
    this._host = '127.0.0.1';
    this._port = 502;
    this._pollInterval = 1000;
    this._timer = null;
    this._tags = [];
    this._unitId = 1;
    this._registerMap = [
      { address: 0, name: 'Temperature_M1', type: 'Float', scale: 0.1, unit: '°C' },
      { address: 2, name: 'Pressure_Main', type: 'Float', scale: 0.1, unit: 'bar' },
      { address: 4, name: 'Level_Tank', type: 'Float', scale: 0.1, unit: '%' },
      { address: 6, name: 'Flow_Rate', type: 'Float', scale: 0.1, unit: 'L/min' },
      { address: 8, name: 'Vibration_M2', type: 'Float', scale: 0.1, unit: 'mm/s' },
      { address: 10, name: 'Current_M1', type: 'Float', scale: 0.1, unit: 'A' },
      { address: 12, name: 'Temperature_BR2', type: 'Float', scale: 0.1, unit: '°C' },
      { address: 14, name: 'Vibration_BR2', type: 'Float', scale: 0.1, unit: 'mm/s' },
      { address: 16, name: 'Convoyeur_Speed', type: 'Float', scale: 0.1, unit: 'm/s' },
      { address: 18, name: 'Produced_Count', type: 'Int32', scale: 1, unit: 'pcs' },
      { address: 20, name: 'Defects_Count', type: 'Int32', scale: 1, unit: 'pcs' },
      { address: 22, name: 'Target_Count', type: 'Int32', scale: 1, unit: 'pcs' },
    ];
    this._coilMap = [
      { address: 0, name: 'Motor_Start', bit: 0 },
      { address: 0, name: 'Motor2_Start', bit: 1 },
      { address: 0, name: 'Emergency_Stop', bit: 2 },
      { address: 0, name: 'Sensor_Entry', bit: 3 },
      { address: 0, name: 'Sensor_Exit', bit: 4 },
    ];
  }

  async connect(config) {
    if (config) {
      if (config.host) this._host = config.host;
      if (config.port) this._port = parseInt(config.port);
      if (config.unitId) this._unitId = parseInt(config.unitId);
      if (config.pollInterval) this._pollInterval = parseInt(config.pollInterval);
    }

    try {
      const modbus = require('jsmodbus');
      this._socket = new net.Socket();
      this._client = new modbus.client.TCP(this._socket, this._unitId);

      await new Promise((resolve, reject) => {
        this._socket.connect(this._port, this._host, resolve);
        this._socket.on('error', reject);
      });

      this._connected = true;
      console.log(`[Modbus] Connected to ${this._host}:${this._port} (unit ${this._unitId})`);
      this.emit('status', { connected: true, host: this._host, port: this._port });

      this._startPolling();
      return { success: true };
    } catch (err) {
      console.log(`[Modbus] Connection error: ${err.message}`);
      this._connected = false;
      this.emit('status', { connected: false, error: err.message });
      return { error: err.message };
    }
  }

  disconnect() {
    this._connected = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._socket) {
      try { this._socket.destroy(); } catch {}
      this._socket = null;
    }
    this._client = null;
    this.emit('status', { connected: false });
    console.log('[Modbus] Disconnected');
  }

  _startPolling() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      if (!this._connected || !this._client) return;
      try {
        // Read holding registers (addresses 0-23)
        const resp = await this._client.readHoldingRegisters(0, 24);
        const data = resp.response._body.values; // Array of 16-bit values

        const tags = [];
        for (const map of this._registerMap) {
          const raw = data[map.address];
          const value = raw !== undefined ? raw * map.scale : 0;
          tags.push({
            id: `MB-HR-${map.address}`,
            name: map.name,
            type: map.type,
            kind: 'Input',
            value: parseFloat(value.toFixed(2)),
            unit: map.unit,
            address: map.address,
            protocol: 'ModbusTCP',
            quality: 'Good',
          });
        }

        // Read coils (address 0, 5 coils)
        try {
          const coilResp = await this._client.readCoils(0, 8);
          const coilData = coilResp.response._body.values; // Array of booleans
          for (const map of this._coilMap) {
            if (coilData[map.bit] !== undefined) {
              tags.push({
                id: `MB-COIL-${map.address}-${map.bit}`,
                name: map.name,
                type: 'Bit',
                kind: 'Input',
                value: coilData[map.bit],
                unit: '',
                address: map.address,
                bit: map.bit,
                protocol: 'ModbusTCP',
                quality: 'Good',
              });
            }
          }
        } catch {}

        this._tags = tags;
        this.emit('tags', tags);
      } catch (err) {
        if (this._connected) {
          console.log(`[Modbus] Poll error: ${err.message}`);
          this._connected = false;
          this.emit('status', { connected: false, error: err.message });
        }
      }
    }, this._pollInterval);
  }

  async writeRegister(address, value) {
    if (!this._connected || !this._client) return { error: 'Modbus not connected' };
    try {
      await this._client.writeSingleRegister(address, value);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  async writeCoil(address, value) {
    if (!this._connected || !this._client) return { error: 'Modbus not connected' };
    try {
      await this._client.writeSingleCoil(address, value);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  getTags() { return [...this._tags]; }

  getStatus() {
    return {
      connected: this._connected,
      host: this._host,
      port: this._port,
      tagCount: this._tags.length,
      protocol: 'ModbusTCP',
    };
  }
}

module.exports = ModbusService;
