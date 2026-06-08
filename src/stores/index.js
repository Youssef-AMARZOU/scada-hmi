import { create } from 'zustand';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export const useAppStore = create((set) => ({
  language: 'fr',
  theme: 'dark',
  sidebarCollapsed: false,
  simulationRunning: false,
  mqttConnected: false,
  influxConnected: false,
  factoryIOConnected: false,
  modbusConnected: false,
  serviceConfig: null,
  setLanguage: (lang) => set({ language: lang }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSimulationRunning: (running) => set({ simulationRunning: running }),
}));

export const useTagStore = create((set, get) => ({
  tags: [],
  connected: false,
  lastUpdate: null,
  source: 'none',
  setTags: (tags) => set({ tags, lastUpdate: Date.now() }),
  setConnected: (connected) => set({ connected }),
  setSource: (source) => set({ source }),
  getTagByName: (name) => get().tags.find((t) => t.name === name),
  getTagsByKind: (kind) => get().tags.filter((t) => t.kind === kind),
  getTagsByType: (type) => get().tags.filter((t) => t.type === type),
}));

export const useAlarmStore = create((set, get) => ({
  alarms: [],
  addAlarm: (alarm) => set((s) => {
    const exists = s.alarms.find((a) => a.tagName === alarm.tagName && !a.acknowledged && a.severity === alarm.severity);
    if (exists) return s;
    return { alarms: [{ ...alarm, id: alarm.id || `ALM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, timestamp: alarm.timestamp || new Date().toISOString(), acknowledged: false }, ...s.alarms].slice(0, 500) };
  }),
  setAlarms: (alarms) => set({ alarms }),
  acknowledgeAlarm: (id) => {
    set((s) => ({ alarms: s.alarms.map(a => a.id === id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a) }));
    if (isElectron) window.electronAPI.alarms.acknowledge(id);
  },
  clearAlarm: (id) => {
    set((s) => ({ alarms: s.alarms.filter(a => a.id !== id) }));
    if (isElectron) window.electronAPI.alarms.clear(id);
  },
  getActiveAlarms: () => get().alarms.filter(a => !a.acknowledged),
  getCriticalCount: () => get().alarms.filter(a => a.severity === 'critical' && !a.acknowledged).length,
}));

export const usePredictionStore = create((set) => ({
  predictions: [],
  setPredictions: (predictions) => set({ predictions }),
}));

export const useGMAOStore = create((set, get) => ({
  workOrders: [],
  assets: [],
  setWorkOrders: (workOrders) => set({ workOrders }),
  setAssets: (assets) => set({ assets }),
  addWorkOrder: async (wo) => {
    if (isElectron) {
      const updated = await window.electronAPI.gmao.saveWorkOrder(wo);
      set({ workOrders: updated });
    } else {
      set((s) => ({ workOrders: [{ ...wo, id: `OT-${Date.now()}`, createdAt: new Date().toISOString() }, ...s.workOrders] }));
    }
  },
  updateWorkOrder: async (id, updates) => {
    const current = get().workOrders.find(wo => wo.id === id);
    if (!current) return;
    const updated = { ...current, ...updates };
    if (isElectron) {
      const all = await window.electronAPI.gmao.saveWorkOrder(updated);
      set({ workOrders: all });
    } else {
      set((s) => ({ workOrders: s.workOrders.map(wo => wo.id === id ? updated : wo) }));
    }
  },
  deleteWorkOrder: async (id) => {
    if (isElectron) {
      const updated = await window.electronAPI.gmao.deleteWorkOrder(id);
      set({ workOrders: updated });
    } else {
      set((s) => ({ workOrders: s.workOrders.filter(wo => wo.id !== id) }));
    }
  },
  getWorkOrdersByStatus: (status) => get().workOrders.filter(wo => wo.status === status),
}));

export const useMESStore = create((set, get) => ({
  productionOrders: [],
  oee: { availability: 0, performance: 0, quality: 0, overall: 0 },
  downtimeEvents: [
    { cause: "Changement d'outil", duration: 45, count: 8 },
    { cause: 'Panne mécanique', duration: 120, count: 3 },
    { cause: 'Attente matière', duration: 30, count: 12 },
    { cause: 'Réglage machine', duration: 25, count: 6 },
    { cause: 'Défaut qualité', duration: 15, count: 4 },
    { cause: 'Pause opérateur', duration: 60, count: 6 },
  ],
  productionState: { running: true, produced: 347, target: 500, defects: 8 },
  setProductionOrders: (orders) => set({ productionOrders: orders }),
  setOEE: (oee) => set({ oee }),
  setProductionState: (state) => set({ productionState: state }),
  updateOEE: (oee) => {
    const overall = (oee.availability * oee.performance * oee.quality) / 10000;
    const full = { ...oee, overall };
    set({ oee: full });
    if (isElectron) window.electronAPI.mes.saveOEE(full);
  },
  addProductionOrder: async (po) => {
    if (isElectron) {
      const updated = await window.electronAPI.mes.saveProductionOrder(po);
      set({ productionOrders: updated });
    } else {
      set((s) => ({ productionOrders: [...s.productionOrders, { ...po, id: `OF-${Date.now()}` }] }));
    }
  },
  updateProductionOrder: async (id, updates) => {
    const current = get().productionOrders.find(po => po.id === id);
    if (!current) return;
    const updated = { ...current, ...updates };
    if (isElectron) {
      const all = await window.electronAPI.mes.saveProductionOrder(updated);
      set({ productionOrders: all });
    } else {
      set((s) => ({ productionOrders: s.productionOrders.map(po => po.id === id ? updated : po) }));
    }
  },
  deleteProductionOrder: async (id) => {
    if (isElectron) {
      const all = await window.electronAPI.mes.saveProductionOrder({ id, _delete: true });
      set({ productionOrders: all.filter(po => po.id !== id) });
    } else {
      set((s) => ({ productionOrders: s.productionOrders.filter(po => po.id !== id) }));
    }
  },
}));

export const useHistoryStore = create((set, get) => ({
  history: [],
  setHistory: (history) => set({ history }),
  getHistory: (name, minutes) => {
    const cutoff = Date.now() - minutes * 60000;
    return get().history.filter(h => h.timestamp >= cutoff && (!name || h[name] !== undefined));
  },
}));