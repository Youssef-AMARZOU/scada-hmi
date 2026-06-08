# INDUS — Cahier des Charges V2.0

## 1. Vision
Plateforme Industrielle Intégrée — une application Electron/React connectée en temps réel 
à des sources de données industrielles réelles (OPC-UA, MQTT, InfluxDB, Factory I/O, Unity, 
datasets Kaggle/HuggingFace) avec maintenance prédictive intégrée (modèle MATLAB/Python).

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐│
│  │Simulation │ │Prediction│ │ Alarm     │ │  Data  ││
│  │Engine     │ │Engine    │ │Engine     │ │Store   ││
│  │(real-time│ │(built-in │ │(ISA 18.2) │ │(SQLite)││
│  │ sensor   │ │ RUL/model│ │           │ │        ││
│  │ data)    │ │          │ │           │ │        ││
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘│
│       │             │             │            │     │
│  ┌────┴─────────────┴─────────────┴────────────┴──┐  │
│  │              Data Bridge (IPC)                  │  │
│  └────────────────────┬───────────────────────────┘  │
└───────────────────────┼──────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────┐
│              React Renderer                         │
│                                                      │
│  Dashboard │ SCADA │ GMAO │ MES │ DigitalTwin │    │
│  Analytics │ Settings                               │
└──────────────────────────────────────────────────────┘

External Connections (when available):
  - Factory I/O  ─── OPC-UA (opc.tcp://localhost:4840)
  - Factory I/O  ─── REST API (http://localhost:7410)
  - Mosquitto    ─── MQTT (mqtt://localhost:1883)
  - InfluxDB 2.x ─── HTTP API (http://localhost:8086)
  - Unity WebSocket ─── ws://localhost:8765
  - MATLAB/Python ─── MQTT or subprocess bridge
  - Kaggle/HF    ─── CSV import via Settings
```

## 3. Modules Fonctionnels

### 3.1 Simulation Engine (NOUVEAU)
- Génère des données capteur réalistes à partir de modèles physiques industriels
- 14 tags simulés: température, pression, débit, niveau, vibration, courant, etc.
- Cycles de production réalistes: démarrage, régime nominal, arrêt
- Injection d'anomalies: dérive lente, pics, oscillations, pannes
- Degré de dégradation progressive des machines
- Données historiques conservées en mémoire (dernières 24h)
- Alimente le même pipeline que Factory I/O/OPC-UA

### 3.2 Prediction Engine (NOUVEAU)
- Remplace le script MATLAB par un modèle intégré
- Régression logistique pour probabilité de défaillance
- Estimation RUL (Remaining Useful Life)
- Seuils de confiance basés sur la qualité des données
- Prédictions mises à jour toutes les 30s
- Publiées via le même canal que MQTT

### 3.3 Dashboard
- KPIs calculés à partir de données réelles (OEE, alarmes, ordres de travail)
- Statut des services en temps réel
- Tendance OEE sur 7 jours (historique InfluxDB ou simulation)
- Taux de production en temps réel

### 3.4 SCADA
- Graphe de tags en temps réel (simulation ou Factory I/O)
- Contrôle Write: modifier les sorties (moteurs, convoyeurs)
- Tendances historiques avec zoom et sélection
- Acknowledge des alarmes en un clic
- Simulateur de pannes (injecter des défauts)

### 3.5 GMAO (Maintenance)
- CRUD complet: création, édition, suppression d'ordres de travail
- Gestion des actifs: ajout, modification, hiérarchie
- Priorités: urgent, high, medium, low
- Types: préventif, correctif, prédictif
- historique et statuts
- Export CSV

### 3.6 MES (Exécution de Production)
- CRUD ordres de fabrication
- Suivi de production en temps réel
- Calcul OEE en temps réel (Disponibilité × Performance × Qualité)
- Pareto des causes d'arrêt avec données réelles
- Progression des ordres

### 3.7 Digital Twin
- Visualisation 3D avec données capteur en temps réel
- Couleurs dynamiques selon l'état des machines
- Données overlay sur les équipements
- Contrôle: cliquer sur un équipement pour agir

### 3.8 Analytics
- Historien: requête InfluxDB pour données réelles (ou simulation historique)
- Prédictions de maintenance (modèle intégré)
- Matrice de corrélation calculée sur données réelles
- Export CSV des données

### 3.9 Settings (NOUVEAU)
- Configuration des services: Factory I/O, OPC-UA, MQTT, InfluxDB
- Enable/disable simulation mode
- Import de datasets (CSV depuis Kaggle/HuggingFace)
- Démarrage/arrêt de la simulation
- Seuils d'alarme configurables
- Gestion du backend MATLAB/Python

## 4. Sources de Données

| Source | Protocole | Données | Fallback |
|--------|-----------|---------|----------|
| Factory I/O | OPC-UA/REST | Tags industriels | Simulation Engine |
| Mosquitto | MQTT | Messages/predictions | Built-in publish |
| InfluxDB 2.x | HTTP/Flux | Historique capteur | In-memory buffer |
| Kaggle/HF CSVs | Import | Datasets maintenance | Embedded defaults |
| MATLAB | MQTT/subprocess | Predictions | Prediction Engine |
| Unity | WebSocket | Digital Twin sync | Three.js fallback |

## 5. Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React 19 + Zustand + ECharts + Three.js |
| Desktop | Electron 42 |
| Build | Vite 8 |
| i18n | i18next (FR/EN) |
| State | Zustand (6 stores) |
| Charts | ECharts (via echarts-for-react) |
| 3D | @react-three/fiber + @react-three/drei |
| Backend | Node.js (Electron main) |
| Time-series | InfluxDB 2.x client |
| Messaging | MQTT (mqtt.js) |
| OPC-UA | node-opcua |
| Persistence | JSON DataStore (atomic writes) |
| Predictions | Built-in logistic regression + RUL |