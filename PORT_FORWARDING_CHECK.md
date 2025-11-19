# 🔧 Vérification Port Forwarding

## ❌ Problème détecté

Le port 9000 n'est **pas accessible depuis Internet**.

Test effectué :
```bash
curl http://82.65.123.20:9000/health
# → Timeout / Connection refused
```

## ✅ Checklist configuration routeur

### 1. Configuration du port forwarding

Dans l'interface de ton routeur, vérifie :

| Paramètre | Valeur attendue |
|-----------|----------------|
| **Port externe** | `9000` |
| **IP interne** | `192.168.50.68` |
| **Port interne** | `9000` |
| **Protocol** | `TCP` (ou TCP+UDP) |
| **Status** | `Activé` |

### 2. Firewall macOS

Sur le Mac mini, vérifie que Node.js est autorisé :

```bash
ssh mac-mini

# Vérifier le firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Autoriser Node.js
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)

# Ou désactiver temporairement pour tester
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

### 3. Vérifier que le serveur écoute sur toutes les interfaces

```bash
ssh mac-mini 'lsof -i:9000 | grep LISTEN'
```

Attendu :
```
node 20413 morgann 12u IPv6 ... TCP *:9000 (LISTEN)
```

Si tu vois `localhost:9000` au lieu de `*:9000`, c'est un problème.

### 4. Test depuis le Mac mini lui-même

```bash
# Test local (devrait marcher)
ssh mac-mini 'curl -s http://localhost:9000/health'

# Test via IP locale (devrait marcher)
ssh mac-mini 'curl -s http://192.168.50.68:9000/health'
```

### 5. Test depuis une autre machine sur ton réseau local

Depuis un autre appareil connecté au même WiFi :
```bash
curl http://192.168.50.68:9000/health
```

## 🔍 Alternative : Utiliser ngrok

Si le port forwarding est compliqué, utilise ngrok :

```bash
ssh mac-mini

# Installer ngrok
arch -arm64 /bin/bash -c "$(curl -fsSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.tgz)"

# Lancer ngrok
ngrok http 9000
```

Tu auras une URL type : `https://abc123.ngrok.io`

**Webhook GitHub** :
- URL : `https://abc123.ngrok.io/webhook`
- Secret : `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d`

⚠️ L'URL ngrok change à chaque redémarrage (version gratuite).

## 📋 Récapitulatif des ports

| Service | Port | Accessible de |
|---------|------|---------------|
| Game server | 3001 | Réseau local uniquement |
| Deploy webhook | 9000 | **Doit être accessible d'Internet** |
| Discord Bot | 3000 | Réseau local uniquement |

## 🎯 Prochaine étape

1. **Vérifier le port forwarding dans ton routeur**
2. **Tester l'accès** : `curl http://82.65.123.20:9000/health`
3. Si ça ne marche pas → **Utiliser ngrok**

Une fois que le port est accessible, configure le webhook GitHub avec :
- URL : `http://82.65.123.20:9000/webhook` (ou URL ngrok)
- Secret : `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d`
