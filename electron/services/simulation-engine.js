const EventEmitter = require('events');

class SimulationEngine extends EventEmitter {
  constructor() {
    super();
    this._running = false;
    this._timer = null;
    this._tick = 0;
    this._tags = [];
    this._history = [];
    this._maxHistory = 8640;
    this._predictions = [];
    this._oee = { availability: 87.5, performance: 92.3, quality: 97.8, overall: 78.9 };
    this._productionState = { running: true, cycleTime: 25, uptime: 0, downtime: 0, produced: 347, defects: 8, target: 500 };
    this._degradation = {};
    this._anomalies = {};
    this._machines = this._initMachines();
    this._sensors = this._initSensors();
    this._tags = this._sensors.map(s => ({
      id: s.id, name: s.name, type: s.type, kind: s.kind, value: s.baseValue, unit: s.unit, machine: s.machine, quality: 'Good',
    }));
    this._predictions = this._initPredictions();
  }

  _initMachines() {
    return {
      'M1': { name: 'Machine M1', status: 'running', rpm: 1450, temp: 72, vibration: 0.8, runtime: 1200, health: 0.92 },
      'M2': { name: 'Machine M2', status: 'degrading', rpm: 1380, temp: 85, vibration: 2.1, runtime: 3400, health: 0.65 },
      'BR2': { name: 'Broyeur BR2', status: 'critical', rpm: 850, temp: 98, vibration: 4.5, runtime: 5600, health: 0.28 },
      'C2': { name: 'Compresseur C2', status: 'running', rpm: 2900, temp: 65, vibration: 0.5, runtime: 800, health: 0.95 },
      'P3': { name: 'Pompe P3', status: 'running', rpm: 1750, temp: 70, vibration: 1.2, runtime: 2100, health: 0.85 },
    };
  }

  _initSensors() {
    return [
      { id: 'SIM-001', name: 'Convoyeur_Speed', type: 'Float', kind: 'Output', baseValue: 1.5, unit: 'm/s', machine: 'C1', min: 0, max: 3 },
      { id: 'SIM-002', name: 'Sensor_Entry', type: 'Bit', kind: 'Input', baseValue: 1, unit: '', machine: 'C1' },
      { id: 'SIM-003', name: 'Sensor_Exit', type: 'Bit', kind: 'Input', baseValue: 0, unit: '', machine: 'C1' },
      { id: 'SIM-004', name: 'Motor_Start', type: 'Bit', kind: 'Output', baseValue: 1, unit: '', machine: 'M1' },
      { id: 'SIM-005', name: 'Temperature_M1', type: 'Float', kind: 'Input', baseValue: 72, unit: '°C', machine: 'M1', min: 20, max: 120 },
      { id: 'SIM-006', name: 'Pressure_Main', type: 'Float', kind: 'Input', baseValue: 45.8, unit: 'bar', machine: 'C2', min: 0, max: 80 },
      { id: 'SIM-007', name: 'Level_Tank', type: 'Float', kind: 'Input', baseValue: 67.2, unit: '%', machine: 'P3', min: 0, max: 100 },
      { id: 'SIM-008', name: 'Motor2_Start', type: 'Bit', kind: 'Output', baseValue: 0, unit: '', machine: 'M2' },
      { id: 'SIM-009', name: 'Emergency_Stop', type: 'Bit', kind: 'Input', baseValue: 0, unit: '', machine: 'ALL' },
      { id: 'SIM-010', name: 'Flow_Rate', type: 'Float', kind: 'Input', baseValue: 23.1, unit: 'L/min', machine: 'P3', min: 0, max: 50 },
      { id: 'SIM-011', name: 'Vibration_M2', type: 'Float', kind: 'Input', baseValue: 2.1, unit: 'mm/s', machine: 'M2', min: 0, max: 10 },
      { id: 'SIM-012', name: 'Current_M1', type: 'Float', kind: 'Input', baseValue: 12.5, unit: 'A', machine: 'M1', min: 0, max: 30 },
      { id: 'SIM-013', name: 'Temperature_BR2', type: 'Float', kind: 'Input', baseValue: 98, unit: '°C', machine: 'BR2', min: 20, max: 150 },
      { id: 'SIM-014', name: 'Vibration_BR2', type: 'Float', kind: 'Input', baseValue: 4.5, unit: 'mm/s', machine: 'BR2', min: 0, max: 10 },
    ];
  }

  _initPredictions() {
    const machines = this._machines;
    return Object.entries(machines).map(([key, m]) => {
      const failureProb = Math.max(0, Math.min(1, 1 - m.health));
      const rul = Math.max(0, Math.round((1 - failureProb) * 1440));
      const confidence = 0.85 + Math.random() * 0.1;
      return {
        id: key,
        machine: m.name,
        failureProbability: Math.round(failureProb * 1000) / 1000,
        rul,
        confidence: Math.round(confidence * 1000) / 1000,
        status: m.health > 0.8 ? 'healthy' : m.health > 0.5 ? 'warning' : 'critical',
        features: { vibration: m.vibration, temperature: m.temp, runtime: m.runtime, health: m.health },
        timestamp: new Date().toISOString(),
      };
    });
  }

  start(intervalMs = 1000) {
    if (this._running) return;
    this._running = true;
    console.log(`[Simulation] Starting industrial data simulation (interval: ${intervalMs}ms)`);
    this._timer = setInterval(() => this._tick_sim(), intervalMs);
    this.emit('status', { running: true, source: 'simulation' });
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    console.log('[Simulation] Stopped');
    this.emit('status', { running: false, source: 'simulation' });
  }

  isRunning() { return this._running; }

  getTags() { return [...this._tags]; }

  getHistory(sensorName, minutes = 60) {
    const cutoff = Date.now() - minutes * 60000;
    return this._history.filter(h => h.timestamp >= cutoff && (!sensorName || h.name === sensorName));
  }

  getPredictions() { return [...this._predictions]; }

  getOEE() { return { ...this._oee }; }

  getProductionState() { return { ...this._productionState }; }

  getMachines() { return Object.entries(this._machines).map(([k, v]) => ({ id: k, ...v })); }

  setTagValue(tagName, value) {
    const tag = this._tags.find(t => t.name === tagName);
    if (tag) {
      tag.value = value;
      tag.quality = 'Good';
      this.emit('tags', [...this._tags]);
      return { success: true };
    }
    return { error: `Tag ${tagName} not found` };
  }

  injectAnomaly(tagName, type, duration) {
    this._anomalies[tagName] = { type, duration: duration || 30, startTick: this._tick };
    console.log(`[Simulation] Anomaly injected: ${tagName} ${type} for ${duration || 30}s`);
    return { success: true };
  }

  setMachineStatus(machineId, status) {
    if (this._machines[machineId]) {
      this._machines[machineId].status = status;
      return { success: true };
    }
    return { error: `Machine ${machineId} not found` };
  }

  _tick_sim() {
    this._tick++;
    const now = Date.now();
    const t = this._tick * 0.1;

    this._tags.forEach(tag => {
      const sensor = this._sensors.find(s => s.id === tag.id);
      if (!sensor) return;

      const machine = this._machines[sensor.machine] || this._machines['M1'];
      const anomaly = this._anomalies[tag.name];
      const elapsed = this._tick;

      let value = sensor.baseValue;

      if (tag.type === 'Float') {
        const noise = (Math.random() - 0.5) * 2;
        const slowDrift = Math.sin(elapsed * 0.005) * 2;
        const mediumWave = Math.sin(elapsed * 0.02) * 1.5;

        if (sensor.name === 'Temperature_M1') {
          value = 72 + slowDrift * 3 + noise * 0.8 + mediumWave;
          if (machine.status === 'critical') value += 15;
          else if (machine.status === 'degrading') value += 5;
        } else if (sensor.name === 'Temperature_BR2') {
          value = 98 + slowDrift * 4 + noise * 1.2;
          if (this._tick % 200 < 50) value += 8;
        } else if (sensor.name === 'Pressure_Main') {
          value = 45.8 + Math.sin(elapsed * 0.01) * 3 + noise * 0.5;
          if (anomaly) value += anomaly.type === 'spike' ? 15 : anomaly.type === 'drift' ? elapsed * 0.01 : 0;
        } else if (sensor.name === 'Level_Tank') {
          value = 67.2 + Math.sin(elapsed * 0.008) * 8 + noise * 0.3;
          value = Math.max(10, Math.min(95, value));
        } else if (sensor.name === 'Flow_Rate') {
          value = 23.1 + Math.sin(elapsed * 0.015) * 4 + noise * 0.6;
        } else if (sensor.name === 'Vibration_M2') {
          const degradation = machine.health < 0.7 ? (1 - machine.health) * 3 : 0;
          value = 2.1 + degradation + Math.sin(elapsed * 0.03) * 0.5 + noise * 0.3;
        } else if (sensor.name === 'Vibration_BR2') {
          value = 4.5 + Math.sin(elapsed * 0.05) * 0.8 + noise * 0.4;
          if (this._tick % 150 < 30) value += 2;
        } else if (sensor.name === 'Current_M1') {
          value = 12.5 + (this._productionState.running ? 3 : 0) + noise * 0.4 + Math.sin(elapsed * 0.02) * 1.5;
        } else if (sensor.name === 'Convoyeur_Speed') {
          value = this._productionState.running ? (1.5 + noise * 0.05) : 0;
        } else {
          value = sensor.baseValue + slowDrift + noise * 1;
        }

        if (sensor.max !== undefined) value = Math.max(sensor.min || 0, Math.min(sensor.max, value));
        tag.value = Math.round(value * 100) / 100;

      } else if (tag.type === 'Bit') {
        if (sensor.name === 'Sensor_Entry') {
          value = Math.random() > 0.3 ? 1 : 0;
        } else if (sensor.name === 'Sensor_Exit') {
          value = Math.random() > 0.4 ? 1 : 0;
        } else if (sensor.name === 'Motor_Start') {
          value = this._productionState.running ? 1 : 0;
        } else if (sensor.name === 'Motor2_Start') {
          value = machine.status !== 'stopped' ? 1 : 0;
        } else if (sensor.name === 'Emergency_Stop') {
          value = 0;
        } else {
          value = sensor.baseValue;
        }
        tag.value = !!value;
      }
    });

    this._history.push({
      timestamp: now,
      ...Object.fromEntries(this._tags.filter(t => t.type === 'Float').map(t => [t.name, t.value])),
    });
    if (this._history.length > this._maxHistory) this._history = this._history.slice(-this._maxHistory);

    const activeAnomalies = { ...this._anomalies };
    for (const [name, a] of Object.entries(activeAnomalies)) {
      if (this._tick - a.startTick > a.duration) delete this._anomalies[name];
    }

    if (this._tick % 30 === 0) this._updatePredictions();
    if (this._tick % 10 === 0) this._updateOEE();
    if (this._tick % 5 === 0) this._updateProduction();
    if (this._tick % 100 === 0) this._degradeMachines();

    this.emit('tags', [...this._tags]);
    if (this._tick % 30 === 0) this.emit('predictions', [...this._predictions]);
    if (this._tick % 10 === 0) this.emit('oee', { ...this._oee });
  }

  _updatePredictions() {
    this._predictions = Object.entries(this._machines).map(([key, m]) => {
      const weights = { vibration: 0.3, temperature: 0.25, pressure: 0.2, runtime: 0.25 };
      const norms = { vibration: m.vibration / 5, temperature: m.temp / 100, runtime: m.runtime / 6000 };
      const score = norms.vibration * weights.vibration + norms.temperature * weights.temperature + 0.3 * weights.pressure + norms.runtime * weights.runtime;
      const failureProb = 1 / (1 + Math.exp(-10 * (score - 0.5)));
      const rul = Math.max(0, Math.round((1 - failureProb) * 1440));
      const confidence = Math.min(0.98, 0.82 + m.runtime / 20000);

      return {
        id: key, machine: m.name,
        failureProbability: Math.round(failureProb * 1000) / 1000,
        rul,
        confidence: Math.round(confidence * 1000) / 1000,
        status: failureProb > 0.7 ? 'critical' : failureProb > 0.3 ? 'warning' : 'healthy',
        features: { vibration: m.vibration, temperature: m.temp, runtime: m.runtime, health: m.health },
        timestamp: new Date().toISOString(),
      };
    });
  }

  _updateOEE() {
    const state = this._productionState;
    const total = state.uptime + state.downtime;
    const availability = total > 0 ? (state.uptime / total * 100) : 87.5;
    const performance = 88 + Math.random() * 6;
    const quality = 96 + Math.random() * 3;
    const overall = (availability * performance * quality) / 10000;

    this._oee = {
      availability: Math.round(availability * 10) / 10,
      performance: Math.round(performance * 10) / 10,
      quality: Math.round(quality * 10) / 10,
      overall: Math.round(overall * 10) / 10,
    };

    state.uptime += this._productionState.running ? 10 : 0;
    state.downtime += this._productionState.running ? 0 : 10;
  }

  _updateProduction() {
    if (this._productionState.running) {
      const rate = this._oee.performance / 100;
      this._productionState.produced += Math.random() > 0.95 ? 0 : (rate > 0.85 ? 2 : 1);
      if (Math.random() < 0.02) this._productionState.defects++;
    }
  }

  _degradeMachines() {
    Object.values(this._machines).forEach(m => {
      if (m.status === 'running') {
        m.health = Math.max(0.5, m.health - 0.001 + Math.random() * 0.0005);
        m.vibration *= (1 + Math.random() * 0.002);
        m.temp += (Math.random() - 0.48) * 0.2;
      } else if (m.status === 'degrading') {
        m.health = Math.max(0.2, m.health - 0.003);
        m.vibration *= (1 + Math.random() * 0.005);
        m.temp += (Math.random() - 0.45) * 0.3;
      } else if (m.status === 'critical') {
        m.health = Math.max(0.05, m.health - 0.005);
        m.vibration *= (1 + Math.random() * 0.01);
        m.temp += (Math.random() - 0.4) * 0.5;
      }
      m.vibration = Math.round(m.vibration * 100) / 100;
      m.temp = Math.round(m.temp * 10) / 10;
      if (m.health > 0.8) m.status = 'running';
      else if (m.health > 0.5) m.status = 'degrading';
      else m.status = 'critical';
    });
  }
}

module.exports = SimulationEngine;