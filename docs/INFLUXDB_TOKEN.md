# Comment récupérer le token InfluxDB

## 1. InfluxDB n'est PAS encore installé
→ Utilise le bouton **"Auto-setup"** dans INDUS Settings → InfluxDB.
INDUS crée automatiquement :
- Utilisateur : `admin`
- Organisation : `indus`  
- Bucket : `factory-data`
- **Token** → sauvegardé automatiquement

---

## 2. InfluxDB est déjà installé

### Via l'interface web
1. Ouvre : http://localhost:8086
2. Connecte-toi (utilisateur : `admin`, mot de passe : `votre-mot-de-passe-ici`)
3. Menu latéral → **Load Data** → **API Tokens**
4. Clique sur le token → **Copy to clipboard**
5. Dans INDUS → Settings → InfluxDB → colle le token → **Connecter**

### Via PowerShell (CLI)
```powershell
$influx = "$env:LOCALAPPDATA\influxdb2\influx.exe"
& $influx auth list --token "OPERATOR_TOKEN"
```

### Via le fichier local
Le token est stocké dans :
```
C:\Users\youss\AppData\Roaming\indus\indus-data\store.json
```
Cherche `"token": "..."` sous `service-config.influxDB`.

---

## 3. Token actuel (si auto-setup déjà fait)

**Token** : `votre-token-influxdb-ici`

Ce token est déjà sauvegardé dans INDUS. Il permet l'accès complet à :
- URL : http://localhost:8086
- Org : `indus`
- Bucket : `factory-data`
