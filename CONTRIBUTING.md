# Contribuer à INDUS

Merci de l'intérêt pour INDUS ! Toute contribution est la bienvenue.

## Comment contribuer

1. **Fork** le dépôt
2. Crée une branche : `git checkout -b feature/ma-feature`
3. Commit tes modifications : `git commit -m 'feat: ajout de ma feature'`
4. Push : `git push origin feature/ma-feature`
5. Ouvre une **Pull Request**

## Règles

- Suis le style de code existant (pas de commentaires, React 19, Zustand stores)
- Les PRs doivent cibler la branche `master`
- Un seul module par PR de préférence
- Teste avec `npm run build` avant de soumettre

## Convention de commits

| Prefixe | Usage |
|---------|-------|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `perf:` | Optimisation |
| `docs:` | Documentation |
| `refactor:` | Refactoring |
| `chore:` | Tâches diverses |

## Stack technique

- **Frontend**: React 19 + Vite 8 + Zustand 5 + React Router 7
- **Desktop**: Electron 42 avec contexte isolé
- **3D**: Three.js + React Three Fiber + Drei
- **Graphiques**: ECharts 6
- **i18n**: i18next (fr/en)
- **Services**: OPC-UA (node-opcua), Modbus TCP (jsmodbus), MQTT (mqtt.js), InfluxDB 2.x
- **Build**: Vite + electron-builder

## Code de conduite

Soyez respectueux et constructif. Les discussions doivent rester techniques et professionnelles.
