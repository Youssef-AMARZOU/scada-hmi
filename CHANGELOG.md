# Changelog

## [1.0.0] — 2026-06-12

### Added
- Full INDUS platform integration — OPC-UA, Modbus TCP, MQTT, InfluxDB, simulation engine
- React frontend with industrial HMI design (French UI, i18n fr/en, flat style)
- Desktop Electron app with custom app icon and taskbar integration
- Dashboard with real-time KPIs, charts (ECharts), and 3D visualization (Three.js/R3F)
- Settings, SCADA, GMAO, and MES pages with routing
- 14 simulation tags covering temperature, pressure, flow, level, vibration, energy, and status

### Infrastructure
- GitHub Actions CI/CD pipeline publishing to GitHub Packages
- Comprehensive README with architecture diagram, module table, protocol specs, and API reference
- CONTRIBUTING.md contribution guide with commit conventions
- Health check script (11 services: OPC-UA, Modbus, MQTT, InfluxDB, Vite, 6 Electron in-process)
- Playwright e2e tests (9 tests covering navigation, KPIs, language toggle, console errors)
- Windows installer (NSIS) via electron-builder
- GitHub Release v1.0.0 with release notes and installer asset

### Performance
- Parallel server launches for fast startup
- Immediate window display with staggered service connections (~3s startup)

### Fixed
- OPC-UA certificate applicationUri matching subjectAltName
- Demo video compressed from 55MB to 1.6MB for GitHub rendering
- Removed debug console.log statements from production build

### Platforms
- Published to GitHub Packages (@youssef-amarzou/indus@1.0.0)
- Pushed to GitLab (https://gitlab.com/Youssef-AMARZOU/scada-hmi)
- Deployed to Hugging Face Spaces (static demo)
- Files uploaded to Kaggle dataset
