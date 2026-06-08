import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { Activity, AlertTriangle, Wrench, Gauge, Zap, Box, Monitor, BarChart3, ArrowUpRight, ArrowDownRight, Settings } from 'lucide-react';
import { useTagStore, useAlarmStore, useGMAOStore, useMESStore, useAppStore, usePredictionStore } from '../../stores/index';
import { NavLink } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const tags = useTagStore((s) => s.tags);
  const connected = useTagStore((s) => s.connected);
  const mqttConnected = useAppStore((s) => s.mqttConnected);
  const influxConnected = useAppStore((s) => s.influxConnected);
  const simRunning = useAppStore((s) => s.simulationRunning);
  const activeAlarms = useAlarmStore((s) => s.getActiveAlarms().length);
  const criticalCount = useAlarmStore((s) => s.getCriticalCount());
  const workOrders = useGMAOStore((s) => s.workOrders);
  const oee = useMESStore((s) => s.oee);
  const predictions = usePredictionStore((s) => s.predictions);
  const [oeeHistory, setOeeHistory] = useState([]);
  const isElectron = !!window.electronAPI;

  const openWO = workOrders.filter(w => w.status === 'planned' || w.status === 'inProgress').length;
  const criticalMachines = predictions.filter(p => p.status === 'critical').length;
  const warningMachines = predictions.filter(p => p.status === 'warning').length;

  useEffect(() => {
    const interval = setInterval(() => {
      setOeeHistory(prev => {
        const next = [...prev, { time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), ...oee }].slice(-24);
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [oee.availability, oee.performance, oee.quality]);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.simulation.status().then(s => useAppStore.setState({ simulationRunning: s.running })).catch(() => {});
  }, [isElectron]);

  const handleToggleSimulation = async () => {
    if (!isElectron) return;
    if (simRunning) {
      await window.electronAPI.simulation.stop();
      useAppStore.setState({ simulationRunning: false });
    } else {
      await window.electronAPI.simulation.start(1000);
      useAppStore.setState({ simulationRunning: true });
    }
  };

  const sparkOption = (data, color) => ({
    grid: { top: 5, bottom: 5, left: 5, right: 5 },
    xAxis: { show: false, data: data.map((_, i) => i) },
    yAxis: { show: false, min: Math.min(...data) - 2, max: Math.max(...data) + 2 },
    series: [{ type: 'line', data, smooth: true, symbol: 'none', lineStyle: { width: 2, color }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '30' }, { offset: 1, color: 'transparent' }] } } }],
    tooltip: { show: false },
  });

  const sparkData = Array.from({ length: 24 }, (_, i) => oee.overall + (Math.random() - 0.5) * 5 + i * 0.3);

  const oeeTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { top: 30, bottom: 30, left: 40, right: 20 },
    xAxis: { type: 'category', data: oeeHistory.map(d => d.time), axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', min: 60, max: 100, axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8', formatter: '{value}%' } },
    series: [
      { name: t('dashboard.availability'), type: 'line', smooth: true, data: oeeHistory.map(d => d.availability), lineStyle: { color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
      { name: t('dashboard.performance'), type: 'line', smooth: true, data: oeeHistory.map(d => d.performance), lineStyle: { color: '#10b981' }, itemStyle: { color: '#10b981' } },
      { name: t('dashboard.quality'), type: 'line', smooth: true, data: oeeHistory.map(d => d.quality), lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
    ],
  };

  const modules = [
    { path: '/gmao', icon: Wrench, key: 'gmao', color: 'var(--accent-purple)', desc: 'Gestion de la maintenance' },
    { path: '/mes', icon: Zap, key: 'mes', color: 'var(--accent-green)', desc: 'Exécution production' },
    { path: '/digital-twin', icon: Box, key: 'digitalTwin', color: 'var(--accent-cyan)', desc: 'Visualisation 3D' },
    { path: '/scada', icon: Monitor, key: 'scada', color: 'var(--accent-amber)', desc: 'Supervision process' },
    { path: '/analytics', icon: BarChart3, key: 'analytics', color: 'var(--accent-blue)', desc: 'Analyse de données' },
    { path: '/settings', icon: Settings, key: 'settings', color: 'var(--text-muted)', desc: 'Configuration services' },
  ];

  return (
    <div className="dashboard fade-in">
      <div className="page-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid-4 dash-kpis">
        <div className="kpi-card green">
          <div className="kpi-header">
            <span className="kpi-label">{t('dashboard.oee')}</span>
            <div className="kpi-icon green"><Gauge size={20} /></div>
          </div>
          <div className="kpi-value">{oee.overall.toFixed(1)}%</div>
          <div className="kpi-trend up"><ArrowUpRight size={14} /> {(oee.overall - 2.3).toFixed(1)}% vs hier</div>
          <div className="kpi-spark"><ReactECharts option={sparkOption(sparkData, '#10b981')} style={{ height: 40, width: '100%' }} notMerge lazyUpdate /></div>
        </div>

        <div className={`kpi-card ${activeAlarms > 0 ? 'red' : 'green'}`}>
          <div className="kpi-header">
            <span className="kpi-label">{t('dashboard.activeAlarms')}</span>
            <div className={`kpi-icon ${activeAlarms > 0 ? 'red' : 'green'}`}><AlertTriangle size={20} /></div>
          </div>
          <div className="kpi-value">{activeAlarms}</div>
          <div className="kpi-trend">{criticalCount} {t('common.critical').toLowerCase()}</div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-header">
            <span className="kpi-label">{t('dashboard.openWorkOrders')}</span>
            <div className="kpi-icon purple"><Wrench size={20} /></div>
          </div>
          <div className="kpi-value">{openWO}</div>
          <div className="kpi-trend down"><ArrowDownRight size={14} /> -1 vs hier</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">{simRunning ? 'Simulation Active' : 'Tags Live'}</span>
            <div className="kpi-icon"><Activity size={20} /></div>
          </div>
          <div className="kpi-value">{connected ? tags.length : (simRunning ? 14 : 0)}</div>
          <div className="kpi-trend up"><ArrowUpRight size={14} /> {t('dashboard.itemsPerHour')}</div>
          <div className="kpi-spark"><ReactECharts option={sparkOption(sparkData.map(v => v + 50), '#3b82f6')} style={{ height: 40, width: '100%' }} notMerge lazyUpdate /></div>
        </div>
      </div>

      <div className="grid-3 dash-section">
        <div className="glass-card dash-system-status">
          <h3 className="section-title">{t('dashboard.systemStatus')}</h3>
          <div className="status-rows">
            <div className="status-row">
              <span className={`conn-dot ${connected || simRunning ? 'connected' : 'disconnected'}`} />
              <span>{simRunning ? 'Simulation' : t('dashboard.factoryIOStatus')}</span>
              <button className={`btn btn-sm ${simRunning ? 'btn-danger' : 'btn-secondary'}`} onClick={handleToggleSimulation} style={{ marginLeft: 'auto' }}>
                {simRunning ? 'Stop' : 'Start'}
              </button>
              <span className={`status-badge ${connected || simRunning ? 'running' : 'stopped'}`}>
                <span className="dot" />{connected || simRunning ? (simRunning ? 'Simulation' : t('common.connected')) : t('common.disconnected')}
              </span>
            </div>
            <div className="status-row">
              <span className={`conn-dot ${mqttConnected ? 'connected' : 'disconnected'}`} />
              <span>{t('dashboard.mqttStatus')}</span>
              <span className={`status-badge ${mqttConnected ? 'running' : 'stopped'}`}><span className="dot" />{mqttConnected ? t('common.connected') : t('common.disconnected')}</span>
            </div>
            <div className="status-row">
              <span className={`conn-dot ${influxConnected ? 'connected' : 'disconnected'}`} />
              <span>{t('dashboard.influxStatus')}</span>
              <span className={`status-badge ${influxConnected ? 'running' : 'stopped'}`}><span className="dot" />{influxConnected ? t('common.connected') : t('common.disconnected')}</span>
            </div>
            {(connected || simRunning) && (
              <div className="tag-summary">
                <div className="tag-stat"><span className="data-value">{tags.length}</span><span>{t('common.tags')}</span></div>
                <div className="tag-stat"><span className="data-value">{tags.filter(t => t.kind === 'Input').length}</span><span>{t('common.inputs')}</span></div>
                <div className="tag-stat"><span className="data-value">{tags.filter(t => t.kind === 'Output').length}</span><span>{t('common.outputs')}</span></div>
              </div>
            )}
          </div>
          {criticalMachines > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', fontWeight: 600 }}>{criticalMachines} machine(s) en état critique</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{warningMachines} en avertissement</div>
            </div>
          )}
        </div>

        <div className="glass-card" style={{ gridColumn: 'span 2' }}>
          <h3 className="section-title">{t('dashboard.oee')}</h3>
          {oeeHistory.length > 2 ? (
            <ReactECharts option={oeeTrendOption} style={{ height: 280, width: '100%' }} notMerge lazyUpdate />
          ) : (
            <div className="empty-state" style={{ height: 280 }}><Activity size={32} /><p>Collecte des données OEE en cours...</p></div>
          )}
        </div>
      </div>

      <div className="dash-modules">
        <h3 className="section-title">{t('dashboard.quickNav')}</h3>
        <div className="grid-auto">
          {modules.map(({ path, icon: Icon, key, color, desc }) => (
            <NavLink key={path} to={path} className="module-card glass-card">
              <div className="module-icon" style={{ color }}><Icon size={28} /></div>
              <div><h4>{t(`nav.${key}`)}</h4><p>{desc}</p></div>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}