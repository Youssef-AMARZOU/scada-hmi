const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

process.on('uncaughtException', (err) => {
  console.error('[INDUS] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[INDUS] Unhandled rejection:', reason);
});

const FactoryIOService = require('./services/factoryio-service');
const OPCUAService = require('./services/opcua-service');
const MQTTService = require('./services/mqtt-service');
const InfluxService = require('./services/influx-service');
const DataStore = require('./services/data-store');
const AlarmEngine = require('./services/alarm-engine');
const ServiceManager = require('./services/service-manager');
const SimulationEngine = require('./services/simulation-engine');
const ModbusService = require('./services/modbus-service');

let mainWindow = null;
const dataStore = new DataStore(app.getPath('userData'));
const factoryIO = new FactoryIOService();
const opcua = new OPCUAService();
const mqttService = new MQTTService();
const influxService = new InfluxService();
const modbusService = new ModbusService();
const alarmEngine = new AlarmEngine();
const serviceManager = new ServiceManager();
const simulation = new SimulationEngine();

let simulationMode = true;

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupTagPipeline(source) {
  source.on('tags', (tags) => {
    send('factoryio-tags', tags);
    influxService.writeTags(tags);
    const newAlarms = alarmEngine.evaluate(tags);
    if (newAlarms.length > 0) {
      send('new-alarms', newAlarms);
      const all = dataStore.get('alarms') || [];
      dataStore.set('alarms', [...newAlarms, ...all].slice(0, 500));
      newAlarms.forEach(a => mqttService.publish(`factory/alarms/${a.severity}`, a));
    }
    mqttService.publish('factory/tags/summary', {
      count: tags.length,
      timestamp: new Date().toISOString(),
    });
  });
  source.on('status', (status) => send('factoryio-status', status));
}

function startDataBridge() {
  setupTagPipeline(factoryIO);
  setupTagPipeline(opcua);
  setupTagPipeline(modbusService);
  setupTagPipeline(simulation);

  simulation.on('predictions', (predictions) => send('predictions', predictions));
  simulation.on('oee', (oee) => {
    dataStore.set('oee', oee);
    send('oee-update', oee);
    mqttService.publish('factory/analytics/oee', oee);
  });

  mqttService.on('status', (status) => send('mqtt-status', status));
  mqttService.on('message', (msg) => send('mqtt-message', msg));
  influxService.on('status', (status) => send('influx-status', status));
  modbusService.on('status', (status) => send('modbus-status', status));
}

function registerIPC() {
  ipcMain.handle('fio:getTags', () => factoryIO.getTags());
  ipcMain.handle('fio:getValues', () => factoryIO.getValues());
  ipcMain.handle('fio:setValues', (_, body) => factoryIO.setValues(body));
  ipcMain.handle('fio:setValuesByName', (_, body) => factoryIO.setValuesByName(body));
  ipcMain.handle('fio:forceValues', (_, body) => factoryIO.forceValues(body));
  ipcMain.handle('fio:releaseValues', (_, body) => factoryIO.releaseValues(body));
  ipcMain.handle('fio:connect', (_, url) => factoryIO.connect(url));
  ipcMain.handle('fio:disconnect', () => factoryIO.disconnect());

  ipcMain.handle('opcua:connect', (_, url) => opcua.connect(url));
  ipcMain.handle('opcua:disconnect', () => opcua.disconnect());
  ipcMain.handle('opcua:getTags', () => opcua.getTags());
  ipcMain.handle('opcua:read', (_, nodeId) => opcua.readValue(nodeId));
  ipcMain.handle('opcua:write', (_, nodeId, value, dataType) => opcua.writeValue(nodeId, value, dataType));
  ipcMain.handle('opcua:status', () => opcua.getStatus());

  ipcMain.handle('modbus:connect', (_, config) => modbusService.connect(config));
  ipcMain.handle('modbus:disconnect', () => modbusService.disconnect());
  ipcMain.handle('modbus:getTags', () => modbusService.getTags());
  ipcMain.handle('modbus:writeRegister', (_, address, value) => modbusService.writeRegister(address, value));
  ipcMain.handle('modbus:writeCoil', (_, address, value) => modbusService.writeCoil(address, value));
  ipcMain.handle('modbus:status', () => modbusService.getStatus());

  ipcMain.handle('mqtt:connect', (_, url) => mqttService.connect(url));
  ipcMain.handle('mqtt:disconnect', () => mqttService.disconnect());
  ipcMain.handle('mqtt:publish', (_, topic, payload) => mqttService.publish(topic, payload));
  ipcMain.handle('mqtt:subscribe', (_, topic) => mqttService.subscribe(topic));
  ipcMain.handle('mqtt:status', () => mqttService.getStatus());

  ipcMain.handle('influx:connect', (_, config) => influxService.connect(config));
  ipcMain.handle('influx:disconnect', () => influxService.disconnect());
  ipcMain.handle('influx:query', (_, fluxQuery) => influxService.query(fluxQuery));
  ipcMain.handle('influx:status', () => influxService.getStatus());
  ipcMain.handle('influx:setup', (_, config) => influxService.setup(config));

  ipcMain.handle('store:get', (_, key) => dataStore.get(key));
  ipcMain.handle('store:set', (_, key, value) => dataStore.set(key, value));
  ipcMain.handle('store:delete', (_, key) => dataStore.delete(key));
  ipcMain.handle('store:getAll', () => dataStore.getAll());

  ipcMain.handle('alarms:getAll', () => dataStore.get('alarms') || []);
  ipcMain.handle('alarms:acknowledge', (_, id) => {
    const alarms = dataStore.get('alarms') || [];
    const updated = alarms.map(a => a.id === id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a);
    dataStore.set('alarms', updated);
    return updated;
  });
  ipcMain.handle('alarms:clear', (_, id) => {
    const alarms = (dataStore.get('alarms') || []).filter(a => a.id !== id);
    dataStore.set('alarms', alarms);
    return alarms;
  });
  ipcMain.handle('alarms:clearAll', () => { dataStore.set('alarms', []); return []; });
  ipcMain.handle('alarms:setThresholds', (_, thresholds) => {
    alarmEngine.setThresholds(thresholds);
    dataStore.set('alarm-thresholds', thresholds);
    return true;
  });
  ipcMain.handle('alarms:getThresholds', () => alarmEngine.getThresholds());

  ipcMain.handle('services:status', () => ({
    factoryIO: factoryIO.getStatus(),
    opcua: opcua.getStatus(),
    mqtt: mqttService.getStatus(),
    influxDB: influxService.getStatus(),
    modbus: modbusService.getStatus(),
    simulation: { running: simulation.isRunning(), mode: simulationMode },
  }));
  ipcMain.handle('services:autostart', () => serviceManager.startAll());
  ipcMain.handle('services:getConfig', () => dataStore.get('service-config') || {
    factoryIO: { url: 'http://localhost:7410', pollInterval: 300, autoConnect: true },
    opcua: { url: 'opc.tcp://localhost:53530', autoConnect: true },
    mqtt: { url: 'mqtt://localhost:1883', autoConnect: true },
    modbus: { host: '127.0.0.1', port: 502, unitId: 1, pollInterval: 1000, autoConnect: true },
    influxDB: { url: 'http://localhost:8086', org: 'indus', bucket: 'factory-data', token: '', autoConnect: false },
    simulation: { enabled: true, interval: 1000 },
  });
  ipcMain.handle('services:setConfig', (_, config) => {
    dataStore.set('service-config', config);
    return true;
  });

  ipcMain.handle('gmao:getWorkOrders', () => dataStore.get('workOrders') || []);
  ipcMain.handle('gmao:saveWorkOrder', (_, wo) => {
    const orders = dataStore.get('workOrders') || [];
    const idx = orders.findIndex(o => o.id === wo.id);
    if (idx >= 0) orders[idx] = wo;
    else orders.unshift({ ...wo, id: `OT-${Date.now()}`, createdAt: new Date().toISOString() });
    dataStore.set('workOrders', orders);
    return orders;
  });
  ipcMain.handle('gmao:deleteWorkOrder', (_, id) => {
    const orders = (dataStore.get('workOrders') || []).filter(o => o.id !== id);
    dataStore.set('workOrders', orders);
    return orders;
  });
  ipcMain.handle('gmao:getAssets', () => dataStore.get('assets') || []);
  ipcMain.handle('gmao:saveAsset', (_, asset) => {
    const assets = dataStore.get('assets') || [];
    const idx = assets.findIndex(a => a.id === asset.id);
    if (idx >= 0) assets[idx] = asset;
    else assets.push({ ...asset, id: `A-${Date.now()}` });
    dataStore.set('assets', assets);
    return assets;
  });

  ipcMain.handle('mes:getProductionOrders', () => dataStore.get('productionOrders') || []);
  ipcMain.handle('mes:saveProductionOrder', (_, po) => {
    const orders = dataStore.get('productionOrders') || [];
    const idx = orders.findIndex(o => o.id === po.id);
    if (idx >= 0) orders[idx] = po;
    else orders.unshift({ ...po, id: `OF-${Date.now()}`, createdAt: new Date().toISOString() });
    dataStore.set('productionOrders', orders);
    return orders;
  });
  ipcMain.handle('mes:getOEE', () => dataStore.get('oee') || { availability: 0, performance: 0, quality: 0, overall: 0 });
  ipcMain.handle('mes:saveOEE', (_, oee) => { dataStore.set('oee', oee); return oee; });

  ipcMain.handle('simulation:start', (_, interval) => {
    simulation.start(interval || 1000);
    simulationMode = true;
    return { running: true };
  });
  ipcMain.handle('simulation:stop', () => {
    simulation.stop();
    simulationMode = false;
    return { running: false };
  });
  ipcMain.handle('simulation:status', () => ({ running: simulation.isRunning(), mode: simulationMode }));
  ipcMain.handle('simulation:getTags', () => simulation.getTags());
  ipcMain.handle('simulation:getHistory', (_, name, minutes) => simulation.getHistory(name, minutes));
  ipcMain.handle('simulation:getPredictions', () => simulation.getPredictions());
  ipcMain.handle('simulation:getOEE', () => simulation.getOEE());
  ipcMain.handle('simulation:setTag', (_, name, value) => simulation.setTagValue(name, value));
  ipcMain.handle('simulation:injectAnomaly', (_, name, type, duration) => simulation.injectAnomaly(name, type, duration));
  ipcMain.handle('simulation:setMachineStatus', (_, id, status) => simulation.setMachineStatus(id, status));
  ipcMain.handle('simulation:getMachines', () => simulation.getMachines());
  ipcMain.handle('simulation:getProductionState', () => simulation.getProductionState());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'INDUS — Plateforme Industrielle Intégrée',
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Force show after 3s even if ready-to-show didn't fire (renderer crash guard)
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);

  mainWindow.webContents.on('did-finish-load', async () => {
    const thresholds = dataStore.get('alarm-thresholds');
    if (thresholds) alarmEngine.setThresholds(thresholds);

    if (!dataStore.get('initialized')) dataStore.initDefaults();

    const config = dataStore.get('service-config') || {};

    if (config.simulation?.enabled !== false) {
      simulation.start(config.simulation?.interval || 1000);
      simulationMode = true;
    }

    if (config.opcua?.autoConnect === true) {
      opcua.connect(config.opcua?.url || 'opc.tcp://localhost:4840');
    }

    if (config.factoryIO?.autoConnect === true) {
      factoryIO.connect(config.factoryIO?.url || 'http://localhost:7410', config.factoryIO?.pollInterval || 300);
    }

    if (config.mqtt?.autoConnect !== false) {
      mqttService.connect(config.mqtt?.url || 'mqtt://localhost:1883');
    }

    if (config.influxDB?.autoConnect !== false && config.influxDB?.token) {
      influxService.connect(config.influxDB);
    }

    if (config.modbus?.autoConnect !== false) {
      modbusService.connect(config.modbus || { host: '127.0.0.1', port: 502, unitId: 1 });
    }
  });

  return mainWindow;
}

app.whenReady().then(() => {
  registerIPC();
  startDataBridge();
  createWindow();
});

app.on('window-all-closed', () => {
  simulation.stop();
  factoryIO.disconnect();
  opcua.disconnect();
  mqttService.disconnect();
  influxService.disconnect();
  modbusService.disconnect();
  dataStore.destroy();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});