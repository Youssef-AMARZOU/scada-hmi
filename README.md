# INDUS — Plateforme Industrielle Integree

**SCADA / HMI / MES / GMAO / MATLAB** — Application desktop temps reel connectee a des protocoles industriels (OPC-UA, Modbus TCP, MQTT) avec stockage de series temporelles (InfluxDB), simulation de capteurs, maintenance predictive, jumeau numerique 3D et backend MATLAB autonome.

![Tech Stack](https://img.shields.io/badge/Electron-42-47848F?logo=electron) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite) ![Three.js](https://img.shields.io/badge/Three.js-0.184-000000?logo=three.js) ![MATLAB](https://img.shields.io/badge/MATLAB-R2026a-orange?logo=mathworks) ![License](https://img.shields.io/badge/License-MIT-green)

[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github)](https://github.com/Youssef-AMARZOU/scada-hmi)
[![GitLab](https://img.shields.io/badge/GitLab-FC6D26?logo=gitlab)](https://gitlab.com/Youssef-AMARZOU/scada-hmi)
[![Hugging Face](https://img.shields.io/badge/HuggingFace-FFD21E?logo=huggingface&logoColor=000)](https://huggingface.co/spaces/YsfMO98/indus-scada-hmi)
[![Kaggle](https://img.shields.io/badge/Kaggle-20BEFF?logo=kaggle)](https://kaggle.com/datasets/amarzouyoussef/indus-scada-hmi)

---

[![REGARDER LA DEMO](screenshots/dashboard.png)](screenshots/demo.mp4)
*Cliquez sur l'image pour voir la demo video*

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Electron Main Process                   │
│                                                            │
│  Simulation    Prediction    Alarm     DataStore           │
│  Engine        Engine        Engine    (SQLite)            │
│                                                            │
│  OPC-UA  │  Modbus  │  MQTT  │  InfluxDB  │  FactoryI/O  │
│  Client   │  Client  │  Client│  Client     │ Client       │
│                                                            │
│                     IPC Bridge                             │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────┴────────────────────────────────────┐
│               React Renderer (Vite)                        │
│                                                            │
│  Dashboard │ SCADA │ GMAO │ MES │ DigitalTwin             │
│  Analytics │ Predictions │ Settings                        │
└────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴────────────────────────────────────┐
│                   MATLAB Backend                            │
│                                                            │
│  HMI (5 onglets)  │  Predictive Model  │  MQTT Bridge     │
│  Simulation        │  RandomForest      │  Node.js bridge   │
│  Real-time UI      │  RUL calculation   │  system() calls   │
└────────────────────────────────────────────────────────────┘
```

## Diagrammes UML

Les diagrammes UML du projet sont dans `docs/uml/` :

| Diagramme | Fichier | Contenu |
|-----------|---------|---------|
| **Classes** | `class-diagram.puml` | 14 classes : ElectronApp, HMIApp, SimulationEngine, MQTTService, MATLABHMI, PredictiveModel... |
| **Sequence** | `sequence-diagram.puml` | Flux complet : demarrage, boucle simulation, MQTT, predictions MATLAB, arret |
| **Composants** | `component-diagram.puml` | Architecture systeme avec 10 composants et protocoles (OPC-UA:4840, Modbus:502, MQTT:1883, InfluxDB:8086) |
| **Cas d'utilisation** | `usecase-diagram.puml` | 11 cas d'utilisation, 4 acteurs (Operateur, Maintenance, Ingenieur, Admin) |
| **Etats** | `state-diagram.puml` | 6 etats machine : Idle, Running, Surveillance, Anomalie, Arret, Maintenance |
| **StarUML** | `indus-model.mdl` | Modele complet StarUML avec tous les diagrammes |

Pour visualiser les `.puml` : installe l'extension [PlantUML](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) dans VS Code, puis `Ctrl+Shift+P` → `PlantUML: Preview`.

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Vue d'ensemble avec KPIs temps reel, diagramme synoptique, jauges et tendances |
| **SCADA** | Supervision avec alarmes ISA-18.2, historique, vues synoptiques (P&ID) |
| **GMAO** | Gestion de Maintenance Assistee par Ordinateur — ordres de travail, actifs, planification |
| **MES** | Manufacturing Execution System — OF, OEE (TRS), arrets |
| **Digital Twin** | Jumeau numerique 3D (Three.js/React Three Fiber) avec vue atelier |
| **Analytics** | Analyse des donnees historiques (ECharts), maintenance predictive (RUL) |
| **Predictions** | Modeles ML/DL : RandomForest (43%), MLP (50%), Regression (R2=0.84), Clustering K-Means |
| **Settings** | Configuration des connexions (OPC-UA, Modbus, MQTT, InfluxDB, Factory I/O) |

## MATLAB Backend

Le backend MATLAB est un HMI autonome avec 5 onglets et simulation temps reel :

| Onglet | Description |
|--------|-------------|
| **Dashboard** | OEE global, etat des machines, probabilite de defaillance, historique vibrations |
| **Monitoring Temps Reel** | Jauges (vibration, temperature, pression), alertes en direct |
| **Predictions & RUL** | Barres de predictions, RUL estime, modeles ML/DL |
| **Analyse FFT** | Spectre frequentiel pour detection de vibrations |
| **Configuration** | Vitesse simulation, pas de temps, MQTT on/off, export PNG |

### Fichiers MATLAB

| Fichier | Description |
|---------|-------------|
| `matlab/indus_hmi.m` | Application HMI complete (5 onglets, simulation, MQTT) |
| `matlab/predictive_model.m` | Script MQTT publisher autonome |
| `matlab/mqtt_bridge.js` | Bridge Node.js pour MQTT (supporte `--file` pour JSON fiable) |
| `matlab/README.md` | Documentation MATLAB |

### Lancement MATLAB

```matlab
cd('C:\Users\youss\OneDrive\Desktop\myproject\INDUS\matlab')
indus_hmi
```

## Protocoles Industriels

| Protocole | Role | Port par defaut |
|-----------|------|----------------|
| **OPC-UA** | Lecture/ecriture de tags serveur OPC-UA | `opc.tcp://localhost:4840` |
| **Modbus TCP** | Lecture registres holding (12) + coils (5), ecriture | `localhost:502` |
| **MQTT** | Publication/abonnement topics, bridge capteurs | `localhost:1883` |
| **Factory I/O** | REST API + OPC-UA avec Factory I/O | `localhost:7410` |
| **InfluxDB 2.x** | Stockage series temporelles, requetes Flux | `localhost:8086` |

## Tags Simulation (14 capteurs)

Le moteur de simulation integre genere des donnees realistes pour 14 tags industriels avec cycles de production (demarrage, regime nominal, arret) et injection d'anomalies programmable (derive lente, pics, oscillations, pannes).

- Température cuve (PT100)
- Pression ligne (4-20mA)
- Debit sortie
- Niveau cuve
- Vibration moteur principal
- Courant moteur principal
- Vitesse convoyeur
- Temperature moteur secondaire
- Pression hydraulique
- Position vanne de regulation
- Taux de defauts
- Temperature environnement
- Humidite environnement
- Compteur de pieces

## Pre-requis

- [Node.js](https://nodejs.org/) 18+
- npm 10+
- (Optionnel) [InfluxDB 2.x](https://portal.influxdata.com/downloads/) pour la persistance
- (Optionnel) [Mosquitto](https://mosquitto.org/download/) pour MQTT externe
- (Optionnel) [Factory I/O](https://factoryio.com/) pour simulation 3D
- (Optionnel) [MATLAB R2026a](https://www.mathworks.com/) pour le backend HMI

## Installation

```bash
# Cloner le depot
git clone https://github.com/Youssef-AMARZOU/scada-hmi.git
cd scada-hmi

# Installer les dependances
npm install

# Rebuild Electron (necessaire si binaire corrompu)
node node_modules/electron/install.js
```

## Demarrage Rapide

### Option 1 : Tout-en-un (recommande)

```bash
start-all.bat
```

Lance : InfluxDB + serveur OPC-UA local + serveur Modbus local + Vite + Electron

### Option 2 : Developpement

```bash
# Terminal 1 — serveurs locaux (OPC-UA:4840 + Modbus:502)
start-servers-only.bat

# Terminal 2 — application
npm run electron:dev
```

### Option 3 : Production

```bash
npm run build
npx electron .
```

### Option 4 : Silencieux (VBS)

Double-cliquez sur `start-all.vbs` — tout demarre en arriere-plan avec une boite de confirmation.

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur Vite seul (sans Electron) |
| `npm run build` | Build production Vite |
| `npm run electron` | Lance Electron en mode production |
| `npm run electron:dev` | Vite + Electron avec rechargement a chaud |

## Configuration

Les parametres sont stockes dans `%APPDATA%\indus\indus-data\store.json`.

### Connexions par defaut

```json
{
  "opcua": { "url": "opc.tcp://localhost:53530", "autoConnect": true },
  "modbus": { "host": "127.0.0.1", "port": 502, "unitId": 1, "pollInterval": 1000 },
  "mqtt": { "url": "mqtt://localhost:1883", "autoConnect": true },
  "influxDB": { "url": "http://localhost:8086", "token": "...", "org": "indus", "bucket": "factory-data", "autoConnect": true },
  "factoryIO": { "url": "http://localhost:7410", "pollInterval": 300, "autoConnect": true },
  "simulation": { "enabled": true, "interval": 1000 }
}
```

## Structure du Projet

```
INDUS/
├── electron/
│   ├── main.js                    # Process principal Electron + IPC
│   ├── preload.js                 # API bridge (OPC-UA, Modbus, MQTT, InfluxDB, etc.)
│   └── services/
│       ├── simulation-engine.js   # Moteur de simulation temps reel (14 tags)
│       ├── opcua-service.js       # Client OPC-UA avec reconnexion
│       ├── modbus-service.js      # Client Modbus TCP (jsmodbus)
│       ├── mqtt-service.js        # Client MQTT avec abonnement
│       ├── influx-service.js      # Client InfluxDB 2.x
│       ├── factoryio-service.js   # Client Factory I/O REST API
│       ├── alarm-engine.js        # Moteur d'alarmes ISA-18.2
│       ├── data-store.js          # Persistance SQLite locale
│       └── service-manager.js     # Orchestrateur de services
├── scripts/
│   ├── local-opcua-server.js      # Serveur OPC-UA local (14 tags, port 4840)
│   ├── local-modbus-server.js     # Serveur Modbus TCP local (12 regs + 5 coils)
│   ├── health-check.js            # Verificateur de sante (11 services)
│   ├── start-influxdb.bat         # Demarrage InfluxDB
│   ├── setup-infra.ps1            # Script d'installation infrastructure
│   └── start-services.ps1         # Lancement services PowerShell
├── matlab/
│   ├── indus_hmi.m                # Application HMI MATLAB (5 onglets)
│   ├── predictive_model.m         # Script MQTT publisher
│   ├── mqtt_bridge.js             # Bridge Node.js pour MQTT
│   └── README.md                  # Documentation MATLAB
├── docs/
│   ├── CAHIER_DES_CHARGES.md      # Cahier des charges detaille
│   ├── INFLUXDB_TOKEN.md          # Guide recuperation token InfluxDB
│   └── uml/
│       ├── class-diagram.puml     # Diagramme de classes (14 classes)
│       ├── sequence-diagram.puml  # Diagramme de sequence
│       ├── component-diagram.puml # Diagramme de composants
│       ├── usecase-diagram.puml   # Diagramme de cas d'utilisation
│       ├── state-diagram.puml     # Diagramme d'etats
│       └── indus-model.mdl       # Modele StarUML complet
├── src/
│   ├── main.jsx                   # Point d'entree React
│   ├── App.jsx                    # Routage (HashRouter, 7 modules)
│   ├── App.css                    # Theme dark industriel (JetBrains Mono)
│   ├── i18n/                      # Internationalisation (fr, en)
│   │   ├── fr.json
│   │   ├── en.json
│   │   └── index.js
│   ├── stores/
│   │   └── index.js               # Zustand stores (app, tags, alarms, MES, GMAO, history)
│   ├── components/
│   │   └── Layout/                # Mise en page (sidebar, header, breadcrumb)
│   └── modules/
│       ├── Dashboard/             # Vue d'ensemble temps reel
│       ├── SCADA/                 # Supervision et alarmes
│       ├── GMAO/                  # Maintenance (OT, actifs)
│       ├── MES/                   # Production (OF, OEE, arrets)
│       ├── DigitalTwin/           # Jumeau numerique 3D
│       ├── Analytics/             # Analyse et maintenance predictive
│       └── Settings/              # Configuration connexions
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── dist/                          # Build de production (genere)
├── start-all.bat                  # Lancement complet (console)
├── start-all.vbs                  # Lancement complet (silencieux)
├── start-servers-only.bat         # Lancement serveurs uniquement
├── package.json
└── vite.config.js
```

## API Electron (Preload)

L'API est exposee via `window.electronAPI` dans le renderer :

```js
// OPC-UA
window.electronAPI.opcua.connect(url)
window.electronAPI.opcua.read(nodeId)
window.electronAPI.opcua.write(nodeId, value, dataType)

// Modbus
window.electronAPI.modbus.connect({ host, port, unitId })
window.electronAPI.modbus.writeRegister(address, value)
window.electronAPI.modbus.writeCoil(address, value)

// MQTT
window.electronAPI.mqtt.publish(topic, payload)

// InfluxDB
window.electronAPI.influx.query(fluxQuery)

// Simulation
window.electronAPI.simulation.start(interval)
window.electronAPI.simulation.injectAnomaly(name, type, duration)
window.electronAPI.simulation.getOEE()
window.electronAPI.simulation.getPredictions()

// Alarms
window.electronAPI.alarms.setThresholds(thresholds)
window.electronAPI.alarms.getAll()

// GMAO / MES
window.electronAPI.gmao.saveWorkOrder(wo)
window.electronAPI.mes.saveProductionOrder(po)
```

## Tests

```bash
# Tests e2e avec Playwright (9 tests)
npx playwright test

# Health check (11 services)
node scripts/health-check.js
```

## Services Externes

### InfluxDB
- Telechargement : [InfluxDB 2.x OSS](https://portal.influxdata.com/downloads/)
- Installation : Extraire dans `%LOCALAPPDATA%\influxdb2\`
- Premier lancement : auto-setup via l'API
- Interface web : http://localhost:8086

### Mosquitto (MQTT)
- Telechargement : [Mosquitto](https://mosquitto.org/download/)
- Service systeme Windows ou executable manuel
- Bridge MATLAB : `matlab/mqtt_bridge.js` via `system()` calls

### Factory I/O
- Logiciel de simulation 3D d'usine avec sorties OPC-UA et REST API

### MATLAB
- MATLAB R2026a avec Industrial Communication Toolbox (optionnel)
- HMI autonome : `matlab/indus_hmi.m`
- MQTT via Node.js bridge (pas de toolbox requise)

## Plateformes

| Plateforme | Lien | Description |
|------------|------|-------------|
| GitHub | [Youssef-AMARZOU/scada-hmi](https://github.com/Youssef-AMARZOU/scada-hmi) | Code source principal |
| GitLab | [Youssef-AMARZOU/scada-hmi](https://gitlab.com/Youssef-AMARZOU/scada-hmi) | Mirror + CI/CD |
| Hugging Face | [YsfMO98/indus-scada-hmi](https://huggingface.co/spaces/YsfMO98/indus-scada-hmi) | Demo statique |
| Kaggle | [amarzouyoussef/indus-scada-hmi](https://kaggle.com/datasets/amarzouyoussef/indus-scada-hmi) | Dataset + kernels |

## Licence

MIT


---
Updated for Pull Shark achievement

---
Updated for Pull Shark PR #2

PR #3