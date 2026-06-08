import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { Database, Download, Brain, Search, BarChart3, Cpu } from 'lucide-react';
import { useTagStore, usePredictionStore, useAppStore } from '../../stores/index';
import './Analytics.css';

export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const tags = useTagStore((s) => s.tags);
  const connected = useTagStore((s) => s.connected);
  const predictions = usePredictionStore((s) => s.predictions);
  const simRunning = useAppStore((s) => s.simulationRunning);
  const [tab, setTab] = useState('historian');
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedSensor, setSelectedSensor] = useState('Temperature_M1');
  const [historyData, setHistoryData] = useState([]);

  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (!isElectron || !simRunning) return;
    const interval = setInterval(async () => {
      try {
        const data = await window.electronAPI.simulation.getHistory(selectedSensor, 60);
        if (data?.length > 0) setHistoryData(data);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [isElectron, simRunning, selectedSensor]);

  const histData = historyData.length > 0 ? historyData.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temp: d.Temperature_M1 ?? d[selectedSensor] ?? 0,
    pressure: d.Pressure_Main ?? 0,
    flow: d.Flow_Rate ?? 0,
  })) : Array.from({ length: 100 }, (_, i) => ({
    time: new Date(Date.now() - (100 - i) * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    temp: 65 + Math.sin(i * 0.15) * 12 + Math.random() * 3,
    pressure: 40 + Math.cos(i * 0.1) * 8 + Math.random() * 2,
    flow: 50 + Math.sin(i * 0.2 + 1) * 10 + Math.random() * 4,
  }));

  const histOption = {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { top: 40, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category', data: histData.map(d => d.time), axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: [
      { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Temperature', type: 'line', data: histData.map(d => d.temp.toFixed(1)), smooth: true, symbol: 'none', lineStyle: { color: '#ef4444' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,68,68,0.15)' }, { offset: 1, color: 'transparent' }] } } },
      { name: 'Pressure', type: 'line', data: histData.map(d => d.pressure.toFixed(1)), smooth: true, symbol: 'none', lineStyle: { color: '#3b82f6' }, yAxisIndex: 1 },
      { name: 'Flow Rate', type: 'line', data: histData.map(d => d.flow.toFixed(1)), smooth: true, symbol: 'none', lineStyle: { color: '#10b981' } },
    ],
    dataZoom: [{ type: 'inside', start: 70, end: 100 }],
  };

  const activePredictions = predictions.length > 0 ? predictions : [
    { machine: 'Machine M1', failureProbability: 0.08, rul: 1200, confidence: 0.94, status: 'healthy' },
    { machine: 'Machine M2', failureProbability: 0.35, rul: 650, confidence: 0.87, status: 'warning' },
    { machine: 'Broyeur BR2', failureProbability: 0.72, rul: 120, confidence: 0.91, status: 'critical' },
    { machine: 'Compresseur C2', failureProbability: 0.05, rul: 1440, confidence: 0.96, status: 'healthy' },
    { machine: 'Pompe P3', failureProbability: 0.15, rul: 800, confidence: 0.89, status: 'healthy' },
  ];

  const corrOption = {
    tooltip: { formatter: (p) => `${p.value[0]} vs ${p.value[1]}: ${p.value[2].toFixed(2)}` },
    grid: { top: 20, bottom: 60, left: 80, right: 20 },
    xAxis: { type: 'category', data: ['Temp', 'Press', 'Flow', 'Vibr', 'Curr'], axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'category', data: ['Temp', 'Press', 'Flow', 'Vibr', 'Curr'], axisLabel: { color: '#94a3b8' } },
    visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#3b82f6', '#1e293b', '#ef4444'] }, textStyle: { color: '#94a3b8' } },
    series: [{
      type: 'heatmap',
      data: [[0,0,1],[0,1,0.72],[0,2,0.35],[0,3,0.58],[0,4,0.45],[1,0,0.72],[1,1,1],[1,2,-0.18],[1,3,0.41],[1,4,0.33],[2,0,0.35],[2,1,-0.18],[2,2,1],[2,3,0.12],[2,4,-0.28],[3,0,0.58],[3,1,0.41],[3,2,0.12],[3,3,1],[3,4,0.87],[4,0,0.45],[4,1,0.33],[4,2,-0.28],[4,3,0.87],[4,4,1]],
      label: { show: true, formatter: (p) => p.value[2].toFixed(1), color: '#f1f5f9', fontSize: 11 },
      itemStyle: { borderRadius: 4, borderColor: '#111827', borderWidth: 2 },
    }]
  };

  return (
    <div className="analytics fade-in">
      <div className="page-header flex-between">
        <div><h1>{t('analytics.title')}</h1><p>{t('analytics.subtitle')}</p></div>
        <button className="btn btn-secondary"><Download size={16} />{t('analytics.exportCSV')}</button>
      </div>

      <div className="grid-4 analytics-kpis">
        <div className="kpi-card"><div className="kpi-header"><span className="kpi-label">{t('analytics.dataPoints')}</span><div className="kpi-icon"><Database size={20} /></div></div><div className="kpi-value">{(historyData.length * 14).toLocaleString()}</div></div>
        <div className="kpi-card green"><div className="kpi-header"><span className="kpi-label">{t('analytics.storageUsed')}</span><div className="kpi-icon green"><BarChart3 size={20} /></div></div><div className="kpi-value">{((historyData.length * 14 * 64) / 1024 / 1024).toFixed(1)} MB</div></div>
        <div className="kpi-card purple"><div className="kpi-header"><span className="kpi-label">{t('analytics.matlabPredictions')}</span><div className="kpi-icon purple"><Brain size={20} /></div></div><div className="kpi-value">{activePredictions.length}</div></div>
        <div className="kpi-card"><div className="kpi-header"><span className="kpi-label">{t('common.tags')}</span><div className="kpi-icon"><Cpu size={20} /></div></div><div className="kpi-value">{connected ? tags.length : (simRunning ? 14 : 0)}</div></div>
      </div>

      <div className="tab-bar">
        <button className={`tab-item ${tab === 'historian' ? 'active' : ''}`} onClick={() => setTab('historian')}><Database size={14} /> {t('analytics.historianExplorer')}</button>
        <button className={`tab-item ${tab === 'matlab' ? 'active' : ''}`} onClick={() => setTab('matlab')}><Brain size={14} /> {t('analytics.matlabPredictions')}</button>
        <button className={`tab-item ${tab === 'correlation' ? 'active' : ''}`} onClick={() => setTab('correlation')}><BarChart3 size={14} /> {t('analytics.correlation')}</button>
      </div>

      <div style={tab === 'historian' ? {} : { display: 'none' }}>
        <div className="filter-bar">
          {tags.filter(t => t.type === 'Float').slice(0, 6).map(tag => (
            <button key={tag.name} className={`btn btn-sm ${selectedSensor === tag.name ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelectedSensor(tag.name)}>
              {tag.name.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="chart-container"><ReactECharts option={histOption} style={{ height: 400, width: '100%' }} notMerge lazyUpdate /></div>
      </div>

      <div style={tab === 'matlab' ? {} : { display: 'none' }}>
        <div className="glass-card">
          <h3 className="section-title"><Brain size={16} style={{ marginRight: 6 }} />{t('analytics.matlabPredictions')}</h3>
          <table className="data-table">
            <thead><tr><th>Machine</th><th>{t('analytics.failureProbability')}</th><th>{t('analytics.remainingLife')}</th><th>{t('analytics.predictionConfidence')}</th><th>{t('common.status')}</th></tr></thead>
            <tbody>
              {activePredictions.map((p, i) => (
                <tr key={i} className={p.status === 'critical' ? 'alarm-critical' : p.status === 'warning' ? 'alarm-warning' : ''}>
                  <td style={{ fontWeight: 500 }}>{p.machine}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ width: 80, height: 8 }}>
                        <div className={`progress-fill ${p.failureProbability > 0.7 ? 'red' : p.failureProbability > 0.3 ? 'amber' : 'green'}`} style={{ width: `${p.failureProbability * 100}%` }} />
                      </div>
                      <span className="data-value" style={{ fontSize: '0.85rem' }}>{(p.failureProbability * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="data-value" style={{ fontSize: '0.9rem' }}>{p.rul}h</td>
                  <td className="data-value" style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{(p.confidence * 100).toFixed(0)}%</td>
                  <td><span className={`status-badge ${p.status === 'critical' ? 'error' : p.status === 'warning' ? 'warning' : 'running'}`}><span className="dot" />{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={tab === 'correlation' ? {} : { display: 'none' }}>
        <div className="chart-container">
          <div className="chart-title">{t('analytics.correlation')} — Matrice de corrélation</div>
          <ReactECharts option={corrOption} style={{ height: 400, width: '100%' }} notMerge lazyUpdate />
        </div>
      </div>
    </div>
  );
}