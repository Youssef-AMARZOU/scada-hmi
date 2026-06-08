const fs = require('fs');
const path = require('path');

/**
 * Persistent JSON Data Store.
 * Stores GMAO work orders, MES production orders, alarms, settings, etc.
 * Uses atomic writes (write to temp, then rename) to prevent corruption.
 */
class DataStore {
  constructor(userDataPath) {
    this._dir = path.join(userDataPath, 'indus-data');
    this._file = path.join(this._dir, 'store.json');
    this._data = {};
    this._dirty = false;
    this._saveTimer = null;

    // Ensure directory exists
    if (!fs.existsSync(this._dir)) {
      fs.mkdirSync(this._dir, { recursive: true });
    }

    // Load existing data
    this._load();

    // Auto-save every 10 seconds if dirty
    this._saveTimer = setInterval(() => {
      if (this._dirty) this._save();
    }, 10000);
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    this._data[key] = value;
    this._dirty = true;
    return true;
  }

  delete(key) {
    delete this._data[key];
    this._dirty = true;
    return true;
  }

  getAll() {
    return { ...this._data };
  }

  /**
   * Populate with realistic industrial default data on first run.
   */
  initDefaults() {
    console.log('[DataStore] Initializing default data...');

    // Default Work Orders
    if (!this._data.workOrders || this._data.workOrders.length === 0) {
      this._data.workOrders = [
        { id: 'OT-2026-001', title: 'Remplacement roulement convoyeur C1', asset: 'Convoyeur C1', priority: 'high', status: 'inProgress', type: 'corrective', assignee: 'M. Dupont', dueDate: '2026-06-10', createdAt: '2026-06-05T08:00:00Z', description: 'Bruit anormal détecté sur le roulement principal du convoyeur C1. Remplacement nécessaire avant défaillance complète.' },
        { id: 'OT-2026-002', title: 'Inspection pompe hydraulique P3', asset: 'Pompe P3', priority: 'medium', status: 'planned', type: 'preventive', assignee: 'A. Martin', dueDate: '2026-06-12', createdAt: '2026-06-04T09:15:00Z', description: 'Inspection planifiée selon le plan de maintenance préventive Q2-2026.' },
        { id: 'OT-2026-003', title: 'Calibration capteur température T5', asset: 'Capteur T5', priority: 'low', status: 'completed', type: 'preventive', assignee: 'S. Bernard', dueDate: '2026-06-08', createdAt: '2026-06-03T14:30:00Z', description: 'Recalibration annuelle du capteur T5 (thermocouple type K). Dérive constatée: +0.8°C.' },
        { id: 'OT-2026-004', title: 'Remplacement moteur broyeur BR2', asset: 'Broyeur BR2', priority: 'urgent', status: 'inProgress', type: 'corrective', assignee: 'M. Dupont', dueDate: '2026-06-07', createdAt: '2026-06-06T06:45:00Z', description: 'Moteur principal HS. Analyse vibratoire avait signalé une dégradation (niveau 4 ISO 10816). Pièce de rechange disponible en stock.' },
        { id: 'OT-2026-005', title: 'Graissage paliers ligne L1', asset: 'Ligne L1', priority: 'medium', status: 'planned', type: 'preventive', assignee: 'P. Leroy', dueDate: '2026-06-15', createdAt: '2026-06-05T10:00:00Z', description: 'Graissage périodique des 12 paliers de la ligne L1. Graisse Shell Gadus S2 V220 2.' },
        { id: 'OT-2026-006', title: 'Analyse vibratoire machine M2', asset: 'Machine M2', priority: 'high', status: 'planned', type: 'predictive', assignee: 'A. Martin', dueDate: '2026-06-11', createdAt: '2026-06-06T11:20:00Z', description: 'Niveaux vibratoires en augmentation sur le palier côté moteur (1.8 → 3.2 mm/s RMS). Diagnostic approfondi requis.' },
        { id: 'OT-2026-007', title: 'Vérification soupape de sécurité SV1', asset: 'Soupape SV1', priority: 'high', status: 'completed', type: 'preventive', assignee: 'S. Bernard', dueDate: '2026-06-06', createdAt: '2026-06-01T07:00:00Z', description: 'Vérification annuelle réglementaire. Pression de tarage: 8.5 bar. Résultat: Conforme.' },
        { id: 'OT-2026-008', title: 'Remplacement filtre compresseur C2', asset: 'Compresseur C2', priority: 'medium', status: 'inProgress', type: 'preventive', assignee: 'P. Leroy', dueDate: '2026-06-09', createdAt: '2026-06-04T13:00:00Z', description: 'Remplacement filtre à air (réf: AF-K200) et filtre à huile (réf: OF-K300). Intervalles: 2000h.' },
        { id: 'OT-2026-009', title: 'Réparation fuite joint palettiseur', asset: 'Palettiseur P1', priority: 'high', status: 'planned', type: 'corrective', assignee: 'M. Dupont', dueDate: '2026-06-13', createdAt: '2026-06-07T08:30:00Z', description: 'Fuite hydraulique détectée au niveau du vérin principal. Joint torique à remplacer.' },
        { id: 'OT-2026-010', title: 'Test fonctionnel automate PLC-03', asset: 'Automate PLC-03', priority: 'low', status: 'completed', type: 'preventive', assignee: 'A. Martin', dueDate: '2026-06-05', createdAt: '2026-05-30T09:00:00Z', description: 'Test cyclique des E/S de l\'automate PLC-03 (Siemens S7-1500). Toutes les voies testées OK.' },
        { id: 'OT-2026-011', title: 'Changement courroie élévateur E1', asset: 'Élévateur E1', priority: 'medium', status: 'planned', type: 'preventive', assignee: 'S. Bernard', dueDate: '2026-06-18', createdAt: '2026-06-07T07:00:00Z', description: 'Courroie d\'entraînement usée (craquelures visibles). Réf: Gates 3VX500.' },
        { id: 'OT-2026-012', title: 'Contrôle alignement laser L2', asset: 'Ligne L2', priority: 'low', status: 'planned', type: 'predictive', assignee: 'P. Leroy', dueDate: '2026-06-20', createdAt: '2026-06-07T10:15:00Z', description: 'Alignement laser des groupes moteur-réducteur de la ligne L2. Outil: Fixturlaser NXA Pro.' },
      ];
    }

    // Default Assets
    if (!this._data.assets || this._data.assets.length === 0) {
      this._data.assets = [
        { id: 'A001', name: 'Ligne de Production L1', type: 'line', status: 'running', location: 'Atelier 1', installDate: '2022-03-15', children: [
          { id: 'A001-1', name: 'Convoyeur C1', type: 'conveyor', status: 'running', model: 'Interroll MCP', serial: 'IR-2022-4501' },
          { id: 'A001-2', name: 'Machine M1', type: 'machine', status: 'running', model: 'Siemens SM400', serial: 'SM-2021-1234' },
          { id: 'A001-3', name: 'Capteur T5', type: 'sensor', status: 'running', model: 'Endress+Hauser TMP', serial: 'EH-T5-001' },
        ]},
        { id: 'A002', name: 'Ligne de Production L2', type: 'line', status: 'warning', location: 'Atelier 1', installDate: '2023-01-20', children: [
          { id: 'A002-1', name: 'Machine M2', type: 'machine', status: 'warning', model: 'Siemens SM400', serial: 'SM-2023-5678' },
          { id: 'A002-2', name: 'Broyeur BR2', type: 'machine', status: 'maintenance', model: 'Metso HP200', serial: 'MT-2020-9012' },
        ]},
        { id: 'A003', name: 'Utilités', type: 'utility', status: 'running', location: 'Local technique', children: [
          { id: 'A003-1', name: 'Compresseur C2', type: 'compressor', status: 'running', model: 'Atlas Copco GA37', serial: 'AC-2021-3456' },
          { id: 'A003-2', name: 'Pompe P3', type: 'pump', status: 'running', model: 'Grundfos CRN 45', serial: 'GF-2022-7890' },
        ]},
        { id: 'A004', name: 'Stockage & Manutention', type: 'warehouse', status: 'running', location: 'Zone logistique', children: [
          { id: 'A004-1', name: 'Palettiseur P1', type: 'palletizer', status: 'stopped', model: 'KUKA KR 240', serial: 'KK-2023-1122' },
          { id: 'A004-2', name: 'Élévateur E1', type: 'elevator', status: 'running', model: 'Liftket Star', serial: 'LK-2022-3344' },
        ]},
      ];
    }

    // Default Production Orders
    if (!this._data.productionOrders || this._data.productionOrders.length === 0) {
      this._data.productionOrders = [
        { id: 'OF-001', product: 'Pièce A-100', quantity: 500, produced: 347, defects: 8, status: 'inProgress', startTime: '2026-06-07T06:00:00Z', estimatedEnd: '2026-06-07T18:00:00Z', line: 'L1', operator: 'Équipe A' },
        { id: 'OF-002', product: 'Assemblage B-200', quantity: 200, produced: 200, defects: 3, status: 'completed', startTime: '2026-06-06T06:00:00Z', estimatedEnd: '2026-06-06T14:00:00Z', line: 'L1', operator: 'Équipe B' },
        { id: 'OF-003', product: 'Composant C-350', quantity: 1000, produced: 0, defects: 0, status: 'planned', startTime: '2026-06-08T06:00:00Z', estimatedEnd: '2026-06-09T06:00:00Z', line: 'L2', operator: '' },
        { id: 'OF-004', product: 'Module D-420', quantity: 150, produced: 89, defects: 2, status: 'inProgress', startTime: '2026-06-07T08:00:00Z', estimatedEnd: '2026-06-07T20:00:00Z', line: 'L2', operator: 'Équipe A' },
        { id: 'OF-005', product: 'Boîtier E-510', quantity: 300, produced: 300, defects: 12, status: 'completed', startTime: '2026-06-05T06:00:00Z', estimatedEnd: '2026-06-05T18:00:00Z', line: 'L1', operator: 'Équipe C' },
        { id: 'OF-006', product: 'Plaque F-600', quantity: 800, produced: 0, defects: 0, status: 'planned', startTime: '2026-06-09T06:00:00Z', estimatedEnd: '2026-06-10T06:00:00Z', line: 'L1', operator: '' },
        { id: 'OF-007', product: 'Pièce A-100', quantity: 250, produced: 125, defects: 4, status: 'onHold', startTime: '2026-06-07T10:00:00Z', estimatedEnd: '2026-06-07T16:00:00Z', line: 'L2', operator: 'Équipe B' },
        { id: 'OF-008', product: 'Assemblage B-200', quantity: 100, produced: 45, defects: 1, status: 'inProgress', startTime: '2026-06-07T12:00:00Z', estimatedEnd: '2026-06-07T22:00:00Z', line: 'L1', operator: 'Équipe A' },
      ];
    }

    // Default OEE
    if (!this._data.oee) {
      this._data.oee = { availability: 87.5, performance: 92.3, quality: 97.8, overall: 78.9 };
    }

    // Default alarm thresholds
    if (!this._data['alarm-thresholds']) {
      this._data['alarm-thresholds'] = [
        { tagPattern: '*', type: 'Float', warningHigh: 80, criticalHigh: 95, warningLow: null, criticalLow: null },
      ];
    }

    this._data.initialized = true;
    this._dirty = true;
    this._save();
    console.log('[DataStore] Defaults initialized');
  }

  _load() {
    try {
      if (fs.existsSync(this._file)) {
        const raw = fs.readFileSync(this._file, 'utf-8');
        this._data = JSON.parse(raw);
        console.log(`[DataStore] Loaded from ${this._file} (${Object.keys(this._data).length} keys)`);
      }
    } catch (err) {
      console.log(`[DataStore] Load error: ${err.message}, starting fresh`);
      this._data = {};
    }
  }

  _save() {
    try {
      const tmp = this._file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this._data, null, 2), 'utf-8');
      fs.renameSync(tmp, this._file);
      this._dirty = false;
    } catch (err) {
      console.log(`[DataStore] Save error: ${err.message}`);
    }
  }

  destroy() {
    if (this._saveTimer) clearInterval(this._saveTimer);
    if (this._dirty) this._save();
  }
}

module.exports = DataStore;
