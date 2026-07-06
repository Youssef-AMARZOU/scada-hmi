# INDUS - MATLAB Backend

Application HMI MATLAB pour maintenance predictive, connectee a l'ecosysteme INDUS via MQTT.

## Fichiers

| Fichier | Description |
|---------|-------------|
| `indus_hmi.m` | Application principale avec interface graphique (5 onglets) |
| `predictive_model.m` | Script publieur MQTT autonome (sans UI) |

## `indus_hmi.m` - Interface HMI

Lance l'IHM complete avec tableau de bord temps reel.

```
>> indus_hmi
```

**Onglets :**
1. **Dashboard** — OEE, etat machines, courbes tendance defaillance/vibration
2. **Monitoring** — 5 machines, 4 capteurs chacun avec code couleur (vert/jaune/rouge)
3. **Predictions & RUL** — Barres RUL avec seuil critique a 200h
4. **Analyse FFT** — Analyse frequentielle de la vibration machine selectionnee
5. **Configuration** — Vitesse simulation, pas de temps, MQTT, reset, export

**Controles :**
- Barre laterale : selectionner une machine pour l'analyse FFT
- Header : Pause/Reprendre la simulation, Injecter/Arreter anomalie
- Export PNG : genere un rapport 4 graphiques

**Predictions :** Regression logistique avec 5 machines, degradation progressive, injection d'anomalies.

**MQTT :** Publie automatiquement sur `factory/predictions/maintenance/{machine}` et `factory/predictions/oee` si le broker Mosquitto tourne sur localhost:1883.

## `predictive_model.m` - Script Publieur

Version simplifiee sans UI, pour cron/automatisation MATLAB.

```
>> predictive_model
```

Publie les memes topics MQTT que l'HMI.

## Dependances

- MATLAB R2024a+ (recent)
- Toolbox: MQTT (built-in `mqttclient`)
- Optionnel: Mosquitto broker (`localhost:1883`)

## Architecture INDUS

```
MATLAB HMI ──MQTT──> Mosquitto ──MQTT──> INDUS Electron App
                                                    │
                                              Dashboard / Analytics
```

MATLAB peut fonctionner de maniere autonome ou comme backend de prediction pour l'app Electron.
