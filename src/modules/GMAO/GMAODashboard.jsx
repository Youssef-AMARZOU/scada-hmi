import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { Wrench, Clock, TrendingUp, DollarSign, Plus, ChevronDown, ChevronRight, X, Save } from 'lucide-react';
import { useGMAOStore } from '../../stores/index';
import './GMAO.css';

const priorityColors = { urgent: 'var(--accent-red)', high: 'var(--accent-amber)', medium: 'var(--accent-blue)', low: 'var(--text-muted)' };
const emptyWO = { title: '', asset: '', priority: 'medium', status: 'planned', type: 'corrective', assignee: '', dueDate: '', description: '' };

export default function GMAODashboard() {
  const { t } = useTranslation();
  const workOrders = useGMAOStore((s) => s.workOrders);
  const assets = useGMAOStore((s) => s.assets);
  const addWorkOrder = useGMAOStore((s) => s.addWorkOrder);
  const [filter, setFilter] = useState('all');
  const [expandedAsset, setExpandedAsset] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newWO, setNewWO] = useState(emptyWO);

  const woByStatus = { planned: 0, inProgress: 0, completed: 0, cancelled: 0 };
  workOrders.forEach(wo => { woByStatus[wo.status] = (woByStatus[wo.status] || 0) + 1; });

  const woByType = { preventive: 0, corrective: 0, predictive: 0 };
  workOrders.forEach(wo => { woByType[wo.type] = (woByType[wo.type] || 0) + 1; });

  const filtered = filter === 'all' ? workOrders : workOrders.filter(wo => wo.status === filter);

  const handleCreate = async () => {
    if (!newWO.title.trim()) return;
    await addWorkOrder({ ...newWO, createdAt: new Date().toISOString() });
    setNewWO(emptyWO);
    setShowModal(false);
  };

  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#94a3b8', fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['35%', '50%'],
      itemStyle: { borderRadius: 6, borderColor: '#111827', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: woByType.preventive, name: t('gmao.preventive'), itemStyle: { color: '#3b82f6' } },
        { value: woByType.corrective, name: t('gmao.corrective'), itemStyle: { color: '#ef4444' } },
        { value: woByType.predictive, name: t('gmao.predictive'), itemStyle: { color: '#8b5cf6' } },
      ]
    }]
  };

  return (
    <div className="gmao fade-in">
      <div className="page-header flex-between">
        <div><h1>{t('gmao.title')}</h1><p>{t('gmao.subtitle')}</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} />{t('gmao.createWO')}</button>
      </div>

      <div className="grid-4 gmao-kpis">
        <div className="kpi-card green"><div className="kpi-header"><span className="kpi-label">{t('gmao.mtbf')}</span><div className="kpi-icon green"><Clock size={20} /></div></div><div className="kpi-value">342h</div><div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:4}}>{t('gmao.mtbfFull')}</div></div>
        <div className="kpi-card amber"><div className="kpi-header"><span className="kpi-label">{t('gmao.mttr')}</span><div className="kpi-icon amber"><Wrench size={20} /></div></div><div className="kpi-value">2.4h</div><div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:4}}>{t('gmao.mttrFull')}</div></div>
        <div className="kpi-card purple"><div className="kpi-header"><span className="kpi-label">{t('gmao.woStatus')}</span><div className="kpi-icon purple"><TrendingUp size={20} /></div></div><div className="kpi-value">{woByStatus.inProgress}</div><div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:4}}>{t('gmao.inProgress')}</div></div>
        <div className="kpi-card"><div className="kpi-header"><span className="kpi-label">{t('gmao.costPerAsset')}</span><div className="kpi-icon"><DollarSign size={20} /></div></div><div className="kpi-value">€1,240</div><div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:4}}>/ {t('common.hours').toLowerCase()}</div></div>
      </div>

      <div className="grid-3 gmao-charts">
        <div className="chart-container"><div className="chart-title">{t('gmao.preventive')} vs {t('gmao.corrective')}</div><ReactECharts option={pieOption} style={{ height: 220, width: '100%' }} notMerge lazyUpdate /></div>

        <div className="glass-card" style={{ gridColumn: 'span 2' }}>
          <div className="chart-title">{t('gmao.assetHealth')}</div>
          <div className="asset-tree">
            {assets.map(asset => (
              <div key={asset.id} className="asset-group">
                <div className="asset-item parent" onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}>
                  {expandedAsset === asset.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className={`status-badge ${asset.status}`}><span className="dot" />{asset.status}</span>
                  <span className="asset-name">{asset.name}</span>
                </div>
                {expandedAsset === asset.id && asset.children?.map(child => (
                  <div key={child.id} className="asset-item child">
                    <span className={`status-badge ${child.status}`}><span className="dot" />{child.status}</span>
                    <span className="asset-name">{child.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card gmao-table-section">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ margin: 0 }}>{t('gmao.recentWO')}</h3>
          <div className="filter-bar" style={{ margin: 0 }}>
            {['all', 'planned', 'inProgress', 'completed'].map(s => (
              <button key={s} className={`tab-item ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                {s === 'all' ? t('common.all') : t(`gmao.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>ID</th><th>{t('gmao.description')}</th><th>{t('gmao.asset')}</th><th>{t('gmao.priority')}</th><th>{t('common.status')}</th><th>{t('gmao.type')}</th><th>{t('gmao.assignee')}</th><th>{t('gmao.dueDate')}</th></tr></thead>
          <tbody>
            {filtered.map(wo => (
              <tr key={wo.id}>
                <td><span className="data-value" style={{ fontSize: '0.85rem' }}>{wo.id}</span></td>
                <td>{wo.title}</td>
                <td><span className="tag-chip">{wo.asset}</span></td>
                <td><span className={`priority-badge ${wo.priority}`}>{t(`gmao.${wo.priority}`)}</span></td>
                <td><span className={`status-badge ${wo.status === 'inProgress' ? 'running' : wo.status === 'completed' ? 'info' : wo.status === 'planned' ? 'warning' : 'stopped'}`}><span className="dot" />{t(`gmao.${wo.status}`)}</span></td>
                <td>{t(`gmao.${wo.type}`)}</td>
                <td>{wo.assignee}</td>
                <td className="data-value" style={{ fontSize: '0.8rem' }}>{wo.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <h2>{t('gmao.createWO')}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="form-group">
              <label>{t('gmao.description')}</label>
              <input value={newWO.title} onChange={e => setNewWO({ ...newWO, title: e.target.value })} placeholder="Description de l'ordre de travail" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>{t('gmao.asset')}</label>
                <select value={newWO.asset} onChange={e => setNewWO({ ...newWO, asset: e.target.value })}>
                  <option value="">Sélectionner un actif</option>
                  {assets.flatMap(a => [a.name, ...(a.children?.map(c => c.name) || [])]).map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('gmao.priority')}</label>
                <select value={newWO.priority} onChange={e => setNewWO({ ...newWO, priority: e.target.value })}>
                  <option value="urgent">Urgent</option>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>{t('gmao.type')}</label>
                <select value={newWO.type} onChange={e => setNewWO({ ...newWO, type: e.target.value })}>
                  <option value="preventive">Préventif</option>
                  <option value="corrective">Correctif</option>
                  <option value="predictive">Prédictif</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('gmao.assignee')}</label>
                <input value={newWO.assignee} onChange={e => setNewWO({ ...newWO, assignee: e.target.value })} placeholder="Responsable" />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>{t('gmao.dueDate')}</label>
                <input type="date" value={newWO.dueDate} onChange={e => setNewWO({ ...newWO, dueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('common.status')}</label>
                <select value={newWO.status} onChange={e => setNewWO({ ...newWO, status: e.target.value })}>
                  <option value="planned">Planifié</option>
                  <option value="inProgress">En cours</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Détails</label>
              <textarea rows={3} value={newWO.description} onChange={e => setNewWO({ ...newWO, description: e.target.value })} placeholder="Détails supplémentaires..." />
            </div>
            <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleCreate}><Save size={16} />Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}