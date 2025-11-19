# 🚀 Configuration GitHub Webhook - Auto-Deploy

## ✅ Statut du déploiement Mac mini

```
✅ Node.js v24.11.1 installé
✅ Deploy server : port 9000 (actif)
✅ Game server : port 3001 (actif)
✅ Port forwarding : 9000 configuré
✅ Auto-start au boot : OK
```

## 🌐 Informations réseau

- **IP publique** : `82.65.123.20`
- **IP locale Mac mini** : `192.168.50.68`
- **Port deploy** : `9000`
- **Port game** : `3001`

## 📝 Configuration GitHub Webhook

### 1. Accéder aux paramètres webhook

1. Va sur https://github.com/morgannito/zombie-browser-game
2. Clique sur **Settings** (en haut à droite)
3. Dans le menu de gauche, clique sur **Webhooks**
4. Clique sur **Add webhook**

### 2. Remplir le formulaire

| Champ | Valeur |
|-------|--------|
| **Payload URL** | `http://82.65.123.20:9000/webhook` |
| **Content type** | `application/json` |
| **Secret** | `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d` |
| **SSL verification** | ⚠️ Disable (car HTTP, pas HTTPS) |
| **Which events** | ✅ Just the push event |
| **Active** | ✅ Coché |

### 3. Sauvegarder

Clique sur **Add webhook**

GitHub va envoyer un ping test immédiatement.

## 🧪 Test du webhook

### Test 1 : Ping automatique de GitHub

Après avoir créé le webhook, GitHub envoie automatiquement un ping.

Vérifier sur le Mac mini :
```bash
ssh mac-mini
tail -f ~/zombie-browser-game/deploy.log
```

Tu devrais voir :
```
[2025-11-19T...] 🔔 Ping event from GitHub
```

### Test 2 : Push test

```bash
# Sur ta machine locale
cd /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA

# Créer un commit test
echo "# Auto-deploy test" >> README.md
git add README.md
git commit -m "test: auto-deploy webhook"
git push origin main
```

### Test 3 : Vérifier le déploiement

Sur le Mac mini, surveiller les logs :
```bash
ssh mac-mini
tail -f ~/zombie-browser-game/deploy.log
```

Tu devrais voir :
```
[timestamp] 🔔 Push detected by morgannito
[timestamp] 🚀 Starting deployment...
[timestamp] 📦 Git pull...
[timestamp] 📦 Installing dependencies...
[timestamp] 🔄 Restarting server...
[timestamp] ✅ Deployment completed successfully!
```

## 🔍 Vérifications post-déploiement

### Sur le Mac mini

```bash
# Vérifier les processus
ssh mac-mini 'lsof -i:9000 -i:3001 | grep node'

# Vérifier les logs
ssh mac-mini 'tail -20 ~/zombie-browser-game/deploy.log'
ssh mac-mini 'tail -20 ~/zombie-browser-game/game-stdout.log'

# Health check
curl http://82.65.123.20:9000/health
```

### Accès au jeu

**URL publique** : http://82.65.123.20:3001

## 📊 Workflow complet

```
Local Dev         GitHub          Mac Mini Deploy       Game Server
    │                │                    │                    │
    │   git push     │                    │                    │
    ├───────────────>│                    │                    │
    │                │   POST /webhook    │                    │
    │                ├───────────────────>│                    │
    │                │                    │  git pull          │
    │                │                    ├────────┐           │
    │                │                    │<───────┘           │
    │                │                    │  npm install       │
    │                │                    ├────────┐           │
    │                │                    │<───────┘           │
    │                │                    │  kill old server   │
    │                │                    ├───────────────────>│
    │                │                    │  start new server  │
    │                │                    ├───────────────────>│
    │                │   200 OK           │                    │
    │                │<───────────────────┤                    │
    │                │                    │                    │
    │                │                    │  Game updated! 🎉  │
```

## 🎯 Commandes utiles

### Logs en temps réel
```bash
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'
```

### Redémarrer les services
```bash
# Redémarrer deploy server
ssh mac-mini 'launchctl stop com.zombiegame.deploy && launchctl start com.zombiegame.deploy'

# Redémarrer game server
ssh mac-mini 'launchctl stop com.zombiegame.game && launchctl start com.zombiegame.game'
```

### Vérifier l'état
```bash
# Services
ssh mac-mini 'launchctl list | grep zombiegame'

# Ports
ssh mac-mini 'lsof -i:9000 -i:3001'

# Health check deploy
curl http://82.65.123.20:9000/health

# Accès game
curl http://82.65.123.20:3001/
```

## ⚠️ Important : Sécurité

Le webhook utilise HTTP (pas HTTPS). Pour la production, il faudrait :

1. **Certificat SSL/TLS** :
   ```bash
   # Avec Let's Encrypt + nginx reverse proxy
   sudo apt install certbot nginx
   # Configurer nginx pour proxy_pass vers :9000
   # Obtenir certificat SSL gratuit
   ```

2. **Firewall** :
   ```bash
   # Autoriser uniquement les IPs de GitHub
   # Liste : https://api.github.com/meta
   ```

3. **Rate limiting** :
   - Ajouter protection contre spam webhooks

## 🎉 C'est prêt !

Ton Mac mini est maintenant un serveur CI/CD comme Render.com !

**Dès que tu push sur GitHub → le jeu se met à jour automatiquement**
