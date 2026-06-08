import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { Monitor, AlertTriangle, TrendingUp, Radio, CheckCircle, X, Bell, Zap, Flame } from 'lucide-react';
import { useTagStore, useAlarmStore, useAppStore } from '../../stores/index';
import './SCADA.css';

export default function SCADADashboard() {
  const { t } = useTranslation();
  const tags = useTagStore((s) => s.tags);
  const connected = useTagStore((s) => s.connected);
  const alarms = useAlarmStore((s) => s.alarms);
  const acknowledge = useAlarmStore((s) => s.acknowledgeAlarm);
  const simRunning = useAppStore((s) => s.simulationRunning);
  const [tab, setTab] = useState('process');
  const [selectedTag, setSelectedTag] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [anomalyTag, setAnomalyTag] = useState('');
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    const interval = setInterval(() => {
      const selected = selectedTag || tags.find(t => t.name === 'Temperature_M1');
      if (selected && selected.type === 'Float') {
        setTrendData(prev => [...prev.slice(-59), { time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), value: selected.value }].slice(-60));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tags, selectedTag]);

  const handleTagControl = async (tagName, value) => {
    if (!isElectron) return;
    if (simRunning) {
      await window.electronAPI.simulation.setTag(tagName, value);
    }
  };

  const handleInjectAnomaly = async () => {
    if (!isElectron || !anomalyTag) return;
    await window.electronAPI.simulation.injectAnomaly(anomalyTag, 'spike', 30);
    setAnomalyTag('');
  };

  const trendOption = {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category', data: trendData.map(d => d.time), axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: [{
      type: 'line', data: trendData.map(d => d.value), smooth: true, symbol: 'none',
      lineStyle: { color: '#06b6d4', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(6,182,212,0.2)' }, { offset: 1, color: 'transparent' }] } },
      markLine: { data: [{ yAxis: 90, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'Seuil critique', color: '#ef4444' } }, { yAxis: 80, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: 'Seuil alarme', color: '#f59e0b' } }], silent: true }
    }]
  };

  return (
    <div className="scada fade-in">
      <div className="page-header flex-between">
        <div><h1>{t('scada.title')}</h1><p>{t('scada.subtitle')}</p></div>
        <div className="flex-gap">
          {simRunning && <span className="status-badge running"><span className="dot" />Simulation</span>}
          {connected && <span className="status-badge running"><span className="dot" />{t('common.live')} — {tags.length} {t('common.tags')}</span>}
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-item ${tab === 'process' ? 'active' : ''}`} onClick={() => setTab('process')}><Monitor size={14} /> {t('scada.processView')}</button>
        <button className={`tab-item ${tab === 'alarms' ? 'active' : ''}`} onClick={() => setTab('alarms')}><AlertTriangle size={14} /> {t('scada.alarmManager')} ({alarms.filter(a => !a.acknowledged).length})</button>
        <button className={`tab-item ${tab === 'trends' ? 'active' : ''}`} onClick={() => setTab('trends')}><TrendingUp size={14} /> {t('scada.trendViewer')}</button>
        <button className={`tab-item ${tab === 'control' ? 'active' : ''}`} onClick={() => setTab('control')}><Zap size={14} /> Contrôle</button>
      </div>

      <div style={tab === 'process' ? {} : { display: 'none' }}>
        <div className="scada-process">
          <div className="glass-card tag-table-card">
            <h3 className="section-title"><Radio size={16} style={{ marginRight: 6 }} />{t('scada.tagBrowser')}</h3>
            <table className="data-table">
              <thead><tr><th>{t('scada.tagName')}</th><th>{t('scada.tagType')}</th><th>{t('scada.tagKind')}</th><th>{t('scada.tagValue')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>
                {tags.map(tag => (
                  <tr key={tag.id || tag.name} onClick={() => tag.type === 'Float' && setSelectedTag(tag)} style={{ cursor: tag.type === 'Float' ? 'pointer' : 'default' }}>
                    <td style={{ fontWeight: 500 }}>{tag.name}</td>
                    <td><span className="tag-chip">{tag.type}</span></td>
                    <td><span className={`tag-chip`} style={tag.kind === 'Output' ? { background: 'rgba(245,158,11,0.1)', color: 'var(--accent-amber)', borderColor: 'rgba(245,158,11,0.2)' } : {}}>{tag.kind}</span></td>
                    <td><span className="data-value" style={{ fontSize: '0.9rem', color: typeof tag.value === 'boolean' ? (tag.value ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--accent-cyan)' }}>
                      {typeof tag.value === 'boolean' ? (tag.value ? '● ON' : '○ OFF') : typeof tag.value === 'number' ? tag.value.toFixed(2) : String(tag.value)}
                    </span></td>
                    <td><span className="status-badge running"><span className="dot" />OK</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={tab === 'alarms' ? {} : { display: 'none' }}>
        <div className="glass-card">
          <h3 className="section-title"><Bell size={16} style={{ marginRight: 6 }} />{t('scada.alarmManager')}</h3>
          {alarms.length === 0 ? (
            <div className="empty-state"><CheckCircle size={48} /><p>Aucune alarme active</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t('scada.timestamp')}</th><th>{t('scada.severity')}</th><th>{t('scada.tagName')}</th><th>{t('scada.message')}</th><th>{t('scada.alarmStatus')}</th><th>{t('common.actions')}</th></tr></thead>
              <tbody>
                {alarms.slice(0, 50).map(alarm => (
                  <tr key={alarm.id} className={!alarm.acknowledged ? (alarm.severity === 'critical' ? 'alarm-critical' : 'alarm-warning') : ''}>
                    <td className="data-value" style={{ fontSize: '0.8rem' }}>{new Date(alarm.timestamp).toLocaleTimeString('fr-FR')}</td>
                    <td><span className={`status-badge ${alarm.severity === 'critical' ? 'error' : alarm.severity}`}><span className="dot" />{alarm.severity}</span></td>
                    <td>{alarm.tagName}</td>
                    <td style={{ fontSize: '0.85rem' }}>{alarm.message}</td>
                    <td><span className={`status-badge ${alarm.acknowledged ? 'info' : 'warning'}`}><span className="dot" />{alarm.acknowledged ? t('scada.acknowledged') : t('scada.activeAlarm')}</span></td>
                    <td>{!alarm.acknowledged && <button className="btn btn-sm btn-secondary" onClick={() => acknowledge(alarm.id)}><CheckCircle size={14} />{t('scada.acknowledge')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={tab === 'trends' ? {} : { display: 'none' }}>
        <div className="chart-container">
          <div className="chart-title">{t('scada.trendViewer')} — {selectedTag ? selectedTag.name : 'Temperature_M1'} {selectedTag?.unit ? `(${selectedTag.unit})` : ''}</div>
          <ReactECharts option={trendOption} style={{ height: 400, width: '100%' }} notMerge lazyUpdate />
          <div className="filter-bar" style={{ marginTop: 12 }}>
            {tags.filter(t => t.type === 'Float').slice(0, 8).map(tag => (
              <button key={tag.name} className={`btn btn-sm ${selectedTag?.name === tag.name ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSelectedTag(tag); setTrendData([]); }}>
                {tag.name.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={tab === 'control' ? {} : { display: 'none' }}>
        <div className="glass-card">
          <h3 className="section-title"><Zap size={16} style={{ marginRight: 6 }} />Contrôle des sorties</h3>
          <table className="data-table">
            <thead><tr><th>Tag</th><th>Type</th><th>Valeur</th><th>Action</th></tr></thead>
            <tbody>
              {tags.filter(t => t.kind === 'Output').map(tag => (
                <tr key={tag.name}>
                  <td style={{ fontWeight: 500 }}>{tag.name}</td>
                  <td><span className="tag-chip">{tag.type}</span></td>
                  <td>
                    {tag.type === 'Bit' ? (
                      <button className={`btn btn-sm ${tag.value ? 'btn-danger' : 'btn-primary'}`} onClick={() => handleTagControl(tag.name, !tag.value)}>
                        {tag.value ? 'ON — Arrêter' : 'OFF — Démarrer'}
                      </button>
                    ) : (
                      <span className="data-value">{typeof tag.value === 'number' ? tag.value.toFixed(2) : String(tag.value)}</span>
                    )}
                  </td>
                  <td>
                    {tag.type === 'Float' && (
                      <input type="range" min="0" max="10" step="0.1" value={tag.value || 0} onChange={e => handleTagControl(tag.name, parseFloat(e.target.value))} style={{ width: 120, accentColor: 'var(--accent-blue)' }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {simRunning && (
          <div className="glass-card" style={{ marginTop: 20 }}>
            <h3 className="section-title"><Flame size={16} style={{ marginRight: 6 }} />Injection d'anomalies</h3>
            <div className="filter-bar">
              {tags.filter(t => t.type === 'Float').slice(0, 6).map(tag => (
                <button key={tag.name} className="btn btn-sm btn-danger" onClick={() => { if (isElectron) window.electronAPI.simulation.injectAnomaly(tag.name, 'spike', 20); }}>
                  Spike {tag.name.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div className="filter-bar" style={{ marginTop: 8 }}>
              {tags.filter(t => t.type === 'Float').slice(0, 6).map(tag => (
                <button key={`drift-${tag.name}`} className="btn btn-sm btn-secondary" onClick={() => { if (isElectron) window.electronAPI.simulation.injectAnomaly(tag.name, 'drift', 60); }}>
                  Dérive {tag.name.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}