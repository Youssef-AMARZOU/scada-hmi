import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { Gauge, TrendingUp, AlertCircle, CheckCircle, Target } from 'lucide-react';
import { useMESStore } from '../../stores/index';
import './MES.css';

export default function MESDashboard() {
  const { t } = useTranslation();
  const oee = useMESStore((s) => s.oee);
  const orders = useMESStore((s) => s.productionOrders);
  const downtimeEvents = useMESStore((s) => s.downtimeEvents);

  const gaugeOpt = (value, title, color) => ({
    series: [{
      type: 'gauge', radius: '90%', startAngle: 220, endAngle: -40,
      min: 0, max: 100,
      axisLine: { lineStyle: { width: 18, color: [[value / 100, color], [1, 'rgba(255,255,255,0.08)']] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { formatter: '{value}%', offsetCenter: [0, 0], fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#f1f5f9' },
      title: { offsetCenter: [0, '70%'], fontSize: 13, color: '#94a3b8' },
      data: [{ value: value.toFixed(1), name: title }],
    }]
  });

  const paretoOption = {
    tooltip: { trigger: 'axis' },
    grid: { top: 30, bottom: 50, left: 60, right: 20 },
    xAxis: { type: 'category', data: downtimeEvents.map(d => d.cause), axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 20 }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: [{
      type: 'bar', data: downtimeEvents.map(d => d.duration), barWidth: '50%',
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#f59e0b' }] }, borderRadius: [4, 4, 0, 0] },
    }]
  };

  return (
    <div className="mes fade-in">
      <div className="page-header">
        <h1>{t('mes.title')}</h1>
        <p>{t('mes.subtitle')}</p>
      </div>

      <div className="mes-oee-section">
        <div className="glass-card oee-main-gauge">
          <h3 className="section-title">{t('mes.overallOEE')}</h3>
          <ReactECharts option={gaugeOpt(oee.overall, 'OEE', '#3b82f6')} style={{ height: 220, width: '100%' }} notMerge lazyUpdate />
          <div className="oee-target"><Target size={14} /><span>{t('mes.targetOEE')}</span></div>
        </div>
        <div className="oee-sub-gauges">
          <div className="chart-container"><ReactECharts option={gaugeOpt(oee.availability, t('dashboard.availability'), '#10b981')} style={{ height: 170, width: '100%' }} notMerge lazyUpdate /></div>
          <div className="chart-container"><ReactECharts option={gaugeOpt(oee.performance, t('dashboard.performance'), '#06b6d4')} style={{ height: 170, width: '100%' }} notMerge lazyUpdate /></div>
          <div className="chart-container"><ReactECharts option={gaugeOpt(oee.quality, t('dashboard.quality'), '#f59e0b')} style={{ height: 170, width: '100%' }} notMerge lazyUpdate /></div>
        </div>
      </div>

      <div className="grid-2 mes-bottom">
        <div className="glass-card">
          <h3 className="section-title">{t('mes.productionOrders')}</h3>
          <div className="po-list">
            {orders.map(po => {
              const pct = po.quantity > 0 ? (po.produced / po.quantity * 100) : 0;
              return (
                <div key={po.id} className="po-item">
                  <div className="flex-between">
                    <div><span className="data-value" style={{ fontSize: '0.85rem' }}>{po.id}</span><span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{po.product}</span></div>
                    <span className={`status-badge ${po.status === 'inProgress' ? 'running' : po.status === 'completed' ? 'info' : po.status === 'onHold' ? 'warning' : 'stopped'}`}>
                      <span className="dot" />{po.status}
                    </span>
                  </div>
                  <div className="flex-between" style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>{po.produced}/{po.quantity} — {po.defects} {t('mes.defects').toLowerCase()}</span>
                    <span className="data-value" style={{ fontSize: '0.8rem' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar" style={{ marginTop: 6 }}>
                    <div className={`progress-fill ${pct >= 100 ? 'green' : pct >= 50 ? '' : 'amber'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-title">{t('mes.downtimePareto')}</div>
          <ReactECharts option={paretoOption} style={{ height: 320, width: '100%' }} notMerge lazyUpdate />
        </div>
      </div>
    </div>
  );
}
