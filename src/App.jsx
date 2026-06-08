import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';

const Dashboard = lazy(() => import('./modules/Dashboard/Dashboard'));
const GMAODashboard = lazy(() => import('./modules/GMAO/GMAODashboard'));
const MESDashboard = lazy(() => import('./modules/MES/MESDashboard'));
const DigitalTwinView = lazy(() => import('./modules/DigitalTwin/DigitalTwinView'));
const SCADADashboard = lazy(() => import('./modules/SCADA/SCADADashboard'));
const AnalyticsDashboard = lazy(() => import('./modules/Analytics/AnalyticsDashboard'));
const SettingsDashboard = lazy(() => import('./modules/Settings/SettingsDashboard'));

const Loading = () => (
  <div className="flex-center" style={{ height: '100%' }}>
    <div className="spinner" />
  </div>
);

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
          <Route path="gmao/*" element={<Suspense fallback={<Loading />}><GMAODashboard /></Suspense>} />
          <Route path="mes/*" element={<Suspense fallback={<Loading />}><MESDashboard /></Suspense>} />
          <Route path="digital-twin" element={<Suspense fallback={<Loading />}><DigitalTwinView /></Suspense>} />
          <Route path="scada/*" element={<Suspense fallback={<Loading />}><SCADADashboard /></Suspense>} />
          <Route path="analytics/*" element={<Suspense fallback={<Loading />}><AnalyticsDashboard /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<Loading />}><SettingsDashboard /></Suspense>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
