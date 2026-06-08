import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Wrench, Factory, Box, Monitor, BarChart3, ChevronLeft, ChevronRight, Cpu, Settings } from 'lucide-react';
import { useAppStore, useTagStore } from '../../stores/index';
import './Sidebar.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, key: 'dashboard', exact: true },
  { path: '/gmao', icon: Wrench, key: 'gmao' },
  { path: '/mes', icon: Factory, key: 'mes' },
  { path: '/digital-twin', icon: Box, key: 'digitalTwin' },
  { path: '/scada', icon: Monitor, key: 'scada' },
  { path: '/analytics', icon: BarChart3, key: 'analytics' },
  { path: '/settings', icon: Settings, key: 'settings' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const fioConnected = useTagStore((s) => s.connected);
  const mqttConnected = useAppStore((s) => s.mqttConnected);
  const influxConnected = useAppStore((s) => s.influxConnected);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon"><Cpu size={24} /></div>
        {!collapsed && <div className="brand-text"><h1>INDUS</h1><span>Plateforme Industrielle</span></div>}
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, icon: Icon, key, exact }) => (
          <NavLink key={path} to={path} end={exact}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={20} />
            {!collapsed && <span>{t(`nav.${key}`)}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="conn-indicators">
            <div className="conn-row">
              <span className={`conn-dot ${fioConnected ? 'connected' : 'disconnected'}`} />
              <span>Factory I/O</span>
              <span className="conn-label">{fioConnected ? '●' : '○'}</span>
            </div>
            <div className="conn-row">
              <span className={`conn-dot ${mqttConnected ? 'connected' : 'disconnected'}`} />
              <span>MQTT</span>
              <span className="conn-label">{mqttConnected ? '●' : '○'}</span>
            </div>
            <div className="conn-row">
              <span className={`conn-dot ${influxConnected ? 'connected' : 'disconnected'}`} />
              <span>InfluxDB</span>
              <span className="conn-label">{influxConnected ? '●' : '○'}</span>
            </div>
          </div>
        )}
        <button className="collapse-btn" onClick={toggle}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
