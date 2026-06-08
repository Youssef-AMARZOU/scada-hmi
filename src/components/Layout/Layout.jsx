import React, { useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useTagStore, useAlarmStore, useGMAOStore, useMESStore, useAppStore, usePredictionStore, useHistoryStore } from '../../stores/index';

export default function Layout() {
  const isElectron = !!window.electronAPI;

  const loadPersistentData = useCallback(async () => {
    if (!isElectron) return;
    try {
      const workOrders = await window.electronAPI.gmao.getWorkOrders();
      if (workOrders?.length > 0) useGMAOStore.setState({ workOrders });
      const assets = await window.electronAPI.gmao.getAssets();
      if (assets?.length > 0) useGMAOStore.setState({ assets });
      const prodOrders = await window.electronAPI.mes.getProductionOrders();
      if (prodOrders?.length > 0) useMESStore.setState({ productionOrders: prodOrders });
      const oee = await window.electronAPI.mes.getOEE();
      if (oee?.overall > 0) useMESStore.setState({ oee });
      const alarms = await window.electronAPI.alarms.getAll();
      if (alarms?.length > 0) useAlarmStore.setState({ alarms });
      const config = await window.electronAPI.services.getConfig();
      if (config) useAppStore.setState({ serviceConfig: config });
      console.log('[INDUS] Persistent data loaded');
    } catch (err) {
      console.error('[INDUS] Error loading persistent data:', err);
    }
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron) return;
    loadPersistentData();

    const unsubTags = window.electronAPI.fio.onTags((tags) => {
      useTagStore.getState().setTags(tags);
      useTagStore.getState().setConnected(true);
    });
    const unsubFioStatus = window.electronAPI.fio.onStatus((status) => {
      useTagStore.getState().setConnected(status.connected);
      if (!status.connected) useTagStore.getState().setTags([]);
    });
    const unsubAlarms = window.electronAPI.alarms.onNew((newAlarms) => {
      const store = useAlarmStore.getState();
      newAlarms.forEach(alarm => store.addAlarm(alarm));
    });
    const unsubMqtt = window.electronAPI.mqtt.onMessage((msg) => {
      if (msg.topic.startsWith('factory/predictions/')) console.log('[MQTT] Prediction:', msg.payload);
      if (msg.topic === 'factory/analytics/oee' && msg.payload) useMESStore.getState().updateOEE(msg.payload);
    });
    const unsubMqttStatus = window.electronAPI.mqtt.onStatus((status) => useAppStore.setState({ mqttConnected: status.connected }));
    const unsubInfluxStatus = window.electronAPI.influx.onStatus((status) => useAppStore.setState({ influxConnected: status.connected }));
    const unsubModbusStatus = window.electronAPI.modbus.onStatus((status) => useAppStore.setState({ modbusConnected: status.connected }));

    const statusInterval = setInterval(async () => {
      try {
        const statuses = await window.electronAPI.services.status();
        useAppStore.setState({
          mqttConnected: statuses.mqtt?.connected || false,
          influxConnected: statuses.influxDB?.connected || false,
          factoryIOConnected: statuses.factoryIO?.connected || false,
          modbusConnected: statuses.modbus?.connected || false,
          simulationRunning: statuses.simulation?.running || false,
        });
      } catch {}
    }, 5000);

    return () => {
      unsubTags?.();
      unsubFioStatus?.();
      unsubAlarms?.();
      unsubMqtt?.();
      unsubMqttStatus?.();
      unsubInfluxStatus?.();
      unsubModbusStatus?.();
      clearInterval(statusInterval);
    };
  }, [isElectron, loadPersistentData]);

  return (
    <div className="app-layout">
      <Sidebar />
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}