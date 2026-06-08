import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Play, Square, Database, Cpu, Wifi, Server, Save, RotateCcw, RefreshCw, Plug, Unplug, HardDrive, Zap, Power } from 'lucide-react';
import { useAppStore } from '../../stores/index';
import './Settings.css';

export default function SettingsDashboard() {
  const { t } = useTranslation();
  const simRunning = useAppStore((s) => s.simulationRunning);
  const mqttConnected = useAppStore((s) => s.mqttConnected);
  const influxConnected = useAppStore((s) => s.influxConnected);
  const fioConnected = useAppStore((s) => s.factoryIOConnected);
  const [config, setConfig] = useState({
    factoryIO: { url: 'http://localhost:7410', pollInterval: 300, autoConnect: true },
    opcua: { url: 'opc.tcp://localhost:53530', autoConnect: true },
    mqtt: { url: 'mqtt://localhost:1883', autoConnect: true },
    modbus: { host: '127.0.0.1', port: 502, unitId: 1, pollInterval: 1000, autoConnect: true },
    influxDB: { url: 'http://localhost:8086', org: 'indus', bucket: 'factory-data', token: '', autoConnect: false },
    simulation: { enabled: true, interval: 1000 },
  });
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState({ opcua: false, mqtt: false, influx: false, fio: false, modbus: false });
  const [services, setServices] = useState(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.services.getConfig().then(c => { if (c) setConfig(c); }).catch(() => {});
    refreshServices();
    const iv = setInterval(refreshServices, 10000);
    return () => clearInterval(iv);
  }, [isElectron]);

  const refreshServices = async () => {
    if (!isElectron) return;
    try {
      const s = await window.electronAPI.services.status();
      setServices(s);
    } catch {}
  };

  const handleSave = async () => {
    if (!isElectron) return;
    await window.electronAPI.services.setConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggleSimulation = async () => {
    if (!isElectron) return;
    if (simRunning) {
      await window.electronAPI.simulation.stop();
      useAppStore.setState({ simulationRunning: false });
    } else {
      await window.electronAPI.simulation.start(config.simulation?.interval || 1000);
      useAppStore.setState({ simulationRunning: true });
    }
  };

  const handleConnect = async (service, action) => {
    if (!isElectron) return;
    setConnecting(prev => ({ ...prev, [service]: true }));
    try {
        if (action === 'connect') {
        if (service === 'opcua') await window.electronAPI.opcua.connect(config.opcua?.url);
        else if (service === 'mqtt') await window.electronAPI.mqtt.connect(config.mqtt?.url);
        else if (service === 'influx') await window.electronAPI.influx.connect(config.influxDB);
        else if (service === 'fio') await window.electronAPI.fio.connect(config.factoryIO?.url);
        else if (service === 'modbus') await window.electronAPI.modbus.connect(config.modbus);
      } else {
        if (service === 'opcua') await window.electronAPI.opcua.disconnect();
        else if (service === 'mqtt') await window.electronAPI.mqtt.disconnect();
        else if (service === 'influx') await window.electronAPI.influx.disconnect();
        else if (service === 'fio') await window.electronAPI.fio.disconnect();
        else if (service === 'modbus') await window.electronAPI.modbus.disconnect();
      }
    } catch {}
    setConnecting(prev => ({ ...prev, [service]: false }));
    setTimeout(refreshServices, 1000);
  };

  const handleInfluxSetup = async () => {
    if (!isElectron) return;
    try {
      const result = await window.electronAPI.influx.setup(config.influxDB);
      if (result.token) {
        setConfig(prev => ({ ...prev, influxDB: { ...prev.influxDB, token: result.token } }));
        await handleConnect('influx', 'connect');
      }
    } catch {}
  };

  const handleConnectAll = async () => {
    if (!isElectron) return;
    const servicesToConnect = ['opcua', 'mqtt', 'modbus', 'fio'];
    for (const svc of servicesToConnect) {
      await handleConnect(svc, 'connect');
    }
  };

  const handleDisconnectAll = async () => {
    if (!isElectron) return;
    const servicesToDisconnect = ['opcua', 'mqtt', 'modbus', 'fio', 'influx'];
    for (const svc of servicesToDisconnect) {
      await handleConnect(svc, 'disconnect');
    }
  };

  const handleResetConfig = () => {
    setConfig({
      factoryIO: { url: 'http://localhost:7410', pollInterval: 300, autoConnect: true },
      opcua: { url: 'opc.tcp://localhost:53530', autoConnect: true },
      mqtt: { url: 'mqtt://localhost:1883', autoConnect: true },
      modbus: { host: '127.0.0.1', port: 502, unitId: 1, pollInterval: 1000, autoConnect: true },
      influxDB: { url: 'http://localhost:8086', org: 'indus', bucket: 'factory-data', token: '', autoConnect: false },
      simulation: { enabled: true, interval: 1000 },
    });
  };

  const ConnectionButton = ({ service, connected, label }) => (
    <div className="flex-gap">
      {connected ? (
        <button className="btn btn-sm btn-danger" onClick={() => handleConnect(service, 'disconnect')} disabled={connecting[service]}>
          <Unplug size={14} /> Déconnecter
        </button>
      ) : (
        <button className="btn btn-sm btn-primary" onClick={() => handleConnect(service, 'connect')} disabled={connecting[service]}>
          <Plug size={14} /> Connecter
        </button>
      )}
      <span className={`status-badge ${connected ? 'running' : 'stopped'}`}><span className="dot" />{connected ? 'Connecté' : 'Déconnecté'}</span>
    </div>
  );

  return (
    <div className="settings fade-in">
      <div className="page-header flex-between">
        <div><h1>{t('settings.title', 'Configuration')}</h1><p>{t('settings.subtitle', 'Connexions et sources de données')}</p></div>
        <div className="flex-gap">
          <button className="btn btn-secondary" onClick={handleDisconnectAll}><Power size={14} /> Tout déconnecter</button>
          <button className="btn btn-primary" onClick={handleConnectAll}><Zap size={14} /> Tout connecter</button>
          <button className="btn btn-secondary" onClick={refreshServices}><RefreshCw size={14} /> Rafraîchir</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16} />{saved ? '✓ Sauvegardé' : 'Sauvegarder'}</button>
        </div>
      </div>

      {services && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <h3 className="section-title"><Cpu size={16} style={{ marginRight: 6 }} />État des services</h3>
          <table className="data-table">
            <thead><tr><th>Service</th><th>Protocole</th><th>Statut</th><th>Tags</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Simulation</td>
                <td><span className="tag-chip">Internal</span></td>
                <td><span className={`status-badge ${simRunning ? 'running' : 'stopped'}`}><span className="dot" />{simRunning ? 'Active' : 'Arrêtée'}</span></td>
                <td className="data-value">{simRunning ? '14' : '0'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>OPC-UA</td>
                <td><span className="tag-chip">{config.opcua?.url}</span></td>
                <td><span className={`status-badge ${services.opcua?.connected ? 'running' : 'stopped'}`}><span className="dot" />{services.opcua?.connected ? 'Connecté' : 'Déconnecté'}</span></td>
                <td className="data-value">{services.opcua?.tagCount || 0}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Factory I/O</td>
                <td><span className="tag-chip">REST {config.factoryIO?.url}</span></td>
                <td><span className={`status-badge ${services.factoryIO?.connected ? 'running' : 'stopped'}`}><span className="dot" />{services.factoryIO?.connected ? 'Connecté' : 'Déconnecté'}</span></td>
                <td className="data-value">{services.factoryIO?.tagCount || 0}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Modbus TCP</td>
                <td><span className="tag-chip">{config.modbus?.host}:{config.modbus?.port}</span></td>
                <td><span className={`status-badge ${services.modbus?.connected ? 'running' : 'stopped'}`}><span className="dot" />{services.modbus?.connected ? 'Connecté' : 'Déconnecté'}</span></td>
                <td className="data-value">{services.modbus?.tagCount || 0}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>MQTT</td>
                <td><span className="tag-chip">{config.mqtt?.url}</span></td>
                <td><span className={`status-badge ${mqttConnected ? 'running' : 'stopped'}`}><span className="dot" />{mqttConnected ? 'Connecté' : 'Déconnecté'}</span></td>
                <td className="data-value">{services.mqtt?.subscriptionCount || 0} sub</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>InfluxDB</td>
                <td><span className="tag-chip">{config.influxDB?.url}</span></td>
                <td><span className={`status-badge ${influxConnected ? 'running' : 'stopped'}`}><span className="dot" />{influxConnected ? 'Connecté' : 'Déconnecté'}</span></td>
                <td className="data-value">{services.influxDB?.writeCount || 0} writes</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="grid-2 settings-grid">
        <div className="glass-card">
          <h3 className="section-title"><Cpu size={16} style={{ marginRight: 6 }} />Simulation Engine</h3>
          <div className="settings-section">
            <div className="setting-row">
              <span>Simulation en temps réel</span>
              <div className="flex-gap">
                <button className={`btn btn-sm ${simRunning ? 'btn-danger' : 'btn-primary'}`} onClick={handleToggleSimulation}>
                  {simRunning ? <><Square size={14} /> Arrêter</> : <><Play size={14} /> Démarrer</>}
                </button>
                <span className={`status-badge ${simRunning ? 'running' : 'stopped'}`}><span className="dot" />{simRunning ? 'Active' : 'Arrêtée'}</span>
              </div>
            </div>
            <div className="setting-row">
              <label>Intervalle (ms)</label>
              <input type="number" value={config.simulation?.interval || 1000} onChange={e => setConfig({ ...config, simulation: { ...config.simulation, interval: parseInt(e.target.value) || 1000 } })} />
            </div>
            <div className="setting-row">
              <label>Tags simulés</label>
              <span className="data-value" style={{ fontSize: '0.8rem' }}>14 tags — Températures, Pression, Débit, Niveau, Vibration, Courant, États binaires</span>
            </div>
            <div className="setting-row">
              <label>Prédictions</label>
              <span className="data-value" style={{ fontSize: '0.8rem' }}>5 machines — RUL, probabilité de défaillance, confiance</span>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 className="section-title"><Server size={16} style={{ marginRight: 6 }} />OPC-UA (Prosys / UaExpert / Factory I/O)</h3>
          <div className="settings-section">
            <div className="setting-row">
              <label>Endpoint URL</label>
              <input value={config.opcua?.url || ''} onChange={e => setConfig({ ...config, opcua: { ...config.opcua, url: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Exemples</label>
              <span className="data-value" style={{ fontSize: '0.75rem' }}>opc.tcp://localhost:4840 · opc.tcp://localhost:53530 · opc.tcp://localhost:12600</span>
            </div>
            <div className="setting-row">
              <label>Auto-connexion</label>
              <input type="checkbox" checked={config.opcua?.autoConnect || false} onChange={e => setConfig({ ...config, opcua: { ...config.opcua, autoConnect: e.target.checked } })} />
            </div>
            <ConnectionButton service="opcua" connected={services?.opcua?.connected || false} />
          </div>
        </div>

        <div className="glass-card">
          <h3 className="section-title"><Wifi size={16} style={{ marginRight: 6 }} />MQTT (Mosquitto / HiveMQ / EMQX)</h3>
          <div className="settings-section">
            <div className="setting-row">
              <label>Broker URL</label>
              <input value={config.mqtt?.url || ''} onChange={e => setConfig({ ...config, mqtt: { ...config.mqtt, url: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Auto-connexion</label>
              <input type="checkbox" checked={config.mqtt?.autoConnect !== false} onChange={e => setConfig({ ...config, mqtt: { ...config.mqtt, autoConnect: e.target.checked } })} />
            </div>
            <ConnectionButton service="mqtt" connected={mqttConnected} />
          </div>
        </div>

        <div className="glass-card">
          <h3 className="section-title"><Database size={16} style={{ marginRight: 6 }} />InfluxDB 2.x</h3>
          <div className="settings-section">
            <div className="setting-row">
              <label>URL</label>
              <input value={config.influxDB?.url || ''} onChange={e => setConfig({ ...config, influxDB: { ...config.influxDB, url: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Organisation</label>
              <input value={config.influxDB?.org || ''} onChange={e => setConfig({ ...config, influxDB: { ...config.influxDB, org: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Bucket</label>
              <input value={config.influxDB?.bucket || ''} onChange={e => setConfig({ ...config, influxDB: { ...config.influxDB, bucket: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Token</label>
              <input type="password" value={config.influxDB?.token || ''} onChange={e => setConfig({ ...config, influxDB: { ...config.influxDB, token: e.target.value } })} />
            </div>
            <ConnectionButton service="influx" connected={influxConnected} />
            <div className="setting-row">
              <label>Première installation ?</label>
              <button className="btn btn-sm btn-secondary" onClick={handleInfluxSetup}>Auto-setup</button>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 className="section-title"><HardDrive size={16} style={{ marginRight: 6 }} />Modbus TCP/IP</h3>
          <div className="settings-section">
            <div className="setting-row">
              <label>Host</label>
              <input value={config.modbus?.host || ''} onChange={e => setConfig({ ...config, modbus: { ...config.modbus, host: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Port</label>
              <input type="number" value={config.modbus?.port || 502} onChange={e => setConfig({ ...config, modbus: { ...config.modbus, port: parseInt(e.target.value) || 502 } })} />
            </div>
            <div className="setting-row">
              <label>Unit ID</label>
              <input type="number" value={config.modbus?.unitId || 1} onChange={e => setConfig({ ...config, modbus: { ...config.modbus, unitId: parseInt(e.target.value) || 1 } })} />
            </div>
            <div className="setting-row">
              <label>Poll interval (ms)</label>
              <input type="number" value={config.modbus?.pollInterval || 1000} onChange={e => setConfig({ ...config, modbus: { ...config.modbus, pollInterval: parseInt(e.target.value) || 1000 } })} />
            </div>
            <div className="setting-row">
              <label>Auto-connexion</label>
              <input type="checkbox" checked={config.modbus?.autoConnect !== false} onChange={e => setConfig({ ...config, modbus: { ...config.modbus, autoConnect: e.target.checked } })} />
            </div>
            <ConnectionButton service="modbus" connected={services?.modbus?.connected || false} />
          </div>
        </div>

        <div className="glass-card">
          <h3 className="section-title"><Cpu size={16} style={{ marginRight: 6 }} />Factory I/O (REST API)</h3>
          <div className="settings-section">
            <div className="setting-row">
              <label>REST API URL</label>
              <input value={config.factoryIO?.url || ''} onChange={e => setConfig({ ...config, factoryIO: { ...config.factoryIO, url: e.target.value } })} />
            </div>
            <div className="setting-row">
              <label>Poll interval (ms)</label>
              <input type="number" value={config.factoryIO?.pollInterval || 300} onChange={e => setConfig({ ...config, factoryIO: { ...config.factoryIO, pollInterval: parseInt(e.target.value) || 300 } })} />
            </div>
            <ConnectionButton service="fio" connected={fioConnected} />
          </div>
        </div>
      </div>
    </div>
  );
}