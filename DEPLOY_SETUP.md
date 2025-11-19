# 🚀 Auto-Deploy Setup Guide

Configuration complète du déploiement automatique sur Mac mini (style Render.com).

---

## 📋 Prérequis

- [x] Mac mini avec macOS
- [x] Node.js installé
- [x] Git configuré
- [x] Projet cloné sur le Mac
- [x] Accès Internet avec IP publique ou tunnel (ngrok/localtunnel)

---

## 🔧 Installation

### Étape 1: Générer un secret webhook

```bash
# Générer un secret fort (32 bytes en hexadécimal)
openssl rand -hex 32
```

Sauvegarde ce secret, tu en auras besoin pour GitHub et le serveur.

### Étape 2: Configurer le serveur de déploiement

```bash
cd /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA

# Copier et éditer la configuration
cp .env.deploy .env.deploy.local

# Éditer avec ton secret
nano .env.deploy.local
```

Modifier `.env.deploy.local`:
```bash
DEPLOY_PORT=9000
GITHUB_WEBHOOK_SECRET=ton-secret-genere-avec-openssl
DEPLOY_BRANCH=main
```

### Étape 3: Rendre deploy-server.js exécutable

```bash
chmod +x deploy-server.js
```

### Étape 4: Tester le serveur de déploiement

```bash
# Test manuel
node deploy-server.js
```

Tu devrais voir:
```
🎧 Deploy server listening on port 9000
📁 Project directory: /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA
🔐 Webhook secret: abc***
📝 Logs: /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA/deploy.log
Ready to receive GitHub webhooks!
```

Appuie sur `Ctrl+C` pour arrêter.

---

## 🌐 Exposition du serveur

### Option A: IP publique (recommandé)

Si ton Mac mini a une IP publique:

1. **Configurer le routeur** pour rediriger le port 9000 vers ton Mac
2. **Configurer le firewall macOS**:
   ```bash
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
   ```

### Option B: Tunnel ngrok (pour test)

```bash
# Installer ngrok
brew install ngrok

# Créer un tunnel
ngrok http 9000
```

Ngrok te donnera une URL publique: `https://abc123.ngrok.io`

### Option C: Localtunnel (gratuit)

```bash
# Installer localtunnel
npm install -g localtunnel

# Créer un tunnel
lt --port 9000 --subdomain zombiegame
```

URL: `https://zombiegame.loca.lt`

---

## ⚙️ Configuration du service macOS (LaunchAgent)

Pour que le serveur démarre automatiquement au boot:

### Étape 1: Éditer le fichier plist

```bash
nano com.zombiegame.deploy.plist
```

Modifier les chemins et le secret:
```xml
<!-- Ligne 12: Chemin vers Node.js (vérifie avec: which node) -->
<string>/usr/local/bin/node</string>

<!-- Ligne 13: Chemin vers deploy-server.js -->
<string>/Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA/deploy-server.js</string>

<!-- Ligne 26: Ton secret webhook -->
<string>ton-secret-genere-avec-openssl</string>
```

### Étape 2: Installer le service

```bash
# Copier vers LaunchAgents
cp com.zombiegame.deploy.plist ~/Library/LaunchAgents/

# Charger le service
launchctl load ~/Library/LaunchAgents/com.zombiegame.deploy.plist

# Démarrer le service
launchctl start com.zombiegame.deploy
```

### Étape 3: Vérifier que le service tourne

```bash
# Check si le processus tourne
ps aux | grep deploy-server

# Check les logs
tail -f deploy.log
tail -f deploy-stdout.log
tail -f deploy-stderr.log
```

### Commandes utiles du service

```bash
# Arrêter
launchctl stop com.zombiegame.deploy

# Redémarrer
launchctl stop com.zombiegame.deploy
launchctl start com.zombiegame.deploy

# Désinstaller
launchctl unload ~/Library/LaunchAgents/com.zombiegame.deploy.plist
rm ~/Library/LaunchAgents/com.zombiegame.deploy.plist
```

---

## 🐙 Configuration GitHub Webhook

### Étape 1: Aller dans les paramètres du repo

1. Va sur GitHub → Ton repo
2. Clique sur **Settings**
3. Dans le menu de gauche, clique sur **Webhooks**
4. Clique sur **Add webhook**

### Étape 2: Configurer le webhook

**Payload URL**:
- Si IP publique: `http://ton-ip-publique:9000/webhook`
- Si ngrok: `https://abc123.ngrok.io/webhook`
- Si localtunnel: `https://zombiegame.loca.lt/webhook`

**Content type**: `application/json`

**Secret**: Ton secret généré avec `openssl rand -hex 32`

**Which events?**:
- Sélectionne **Just the push event**

**Active**: ✅ Coché

Clique sur **Add webhook**

### Étape 3: Tester le webhook

GitHub va envoyer un ping. Tu devrais voir dans les logs:

```bash
tail -f deploy.log
```

```
[2025-11-19T...] 📬 Received GitHub event: ping
```

---

## 🧪 Test complet

### Test 1: Webhook ping (déjà fait)

Vérifie que GitHub a bien reçu un code 200.

### Test 2: Push vers main

```bash
# Sur ton Mac de développement
cd /path/to/local/project
echo "test deploy" >> test.txt
git add test.txt
git commit -m "test: auto deploy"
git push origin main
```

Sur le Mac mini, vérifie les logs:

```bash
tail -f deploy.log
```

Tu devrais voir:
```
[2025-11-19...] 📬 Received GitHub event: push
[2025-11-19...] 🔔 Push detected to main branch by ton-nom
[2025-11-19...] ========================================
[2025-11-19...] 🚀 Starting deployment...
[2025-11-19...] Step 1/6: Stopping existing server...
[2025-11-19...] Step 2/6: Pulling latest changes...
[2025-11-19...] Step 3/6: Installing dependencies...
[2025-11-19...] Step 4/6: Cleaning up zombie processes...
[2025-11-19...] Step 5/6: Starting server...
[2025-11-19...] Step 6/6: Verifying server startup...
[2025-11-19...] ✅ Server is running on port 3000
[2025-11-19...] ✅ Deployment completed successfully!
[2025-11-19...] ========================================
```

### Test 3: Déploiement manuel

Si tu veux forcer un déploiement sans push:

```bash
curl -X POST http://localhost:9000/deploy \
  -H "Authorization: Bearer ton-secret-webhook"
```

---

## 📊 Monitoring

### Vérifier l'état du déploiement

```bash
# Health check
curl http://localhost:9000/health
```

Réponse:
```json
{
  "status": "healthy",
  "uptime": 12345,
  "deployServer": "running"
}
```

### Consulter les logs

```bash
# Logs de déploiement
tail -f deploy.log

# Stdout du service
tail -f deploy-stdout.log

# Stderr du service
tail -f deploy-stderr.log

# Logs du serveur game
tail -f server.log
```

### Vérifier que le jeu tourne

```bash
# Check port 3000
lsof -i:3000

# Test HTTP
curl http://localhost:3000
```

---

## 🔒 Sécurité

### 1. Utiliser un secret fort

```bash
# Générer un nouveau secret
openssl rand -hex 32
```

### 2. Firewall macOS

```bash
# Bloquer tous sauf les ports nécessaires
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Autoriser Node.js
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

### 3. HTTPS (recommandé en production)

Utilise un reverse proxy (nginx) avec Let's Encrypt:

```bash
brew install nginx certbot

# Configurer nginx pour proxifier vers port 9000
# Obtenir un certificat SSL avec certbot
```

---

## 🐛 Troubleshooting

### Le service ne démarre pas

```bash
# Vérifier les logs du système
log show --predicate 'eventMessage contains "zombiegame"' --last 1h

# Vérifier les permissions
ls -la deploy-server.js
chmod +x deploy-server.js

# Vérifier que Node.js est au bon chemin
which node
# Mettre à jour le plist si différent de /usr/local/bin/node
```

### Le webhook ne reçoit rien

```bash
# Vérifier que le serveur écoute
lsof -i:9000

# Tester localement
curl -X POST http://localhost:9000/webhook \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main"}'

# Vérifier le tunnel (si ngrok/localtunnel)
curl https://ton-tunnel.ngrok.io/health
```

### Le déploiement échoue

```bash
# Vérifier les permissions Git
cd /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA
git status
git pull origin main

# Vérifier npm
npm install

# Vérifier les logs détaillés
tail -f deploy.log
```

### Le jeu ne démarre pas après déploiement

```bash
# Vérifier les processus
ps aux | grep node

# Vérifier le port 3000
lsof -i:3000

# Démarrer manuellement
npm start

# Vérifier les logs
tail -f server.log
```

---

## 📝 Workflow complet

### Développement local

```bash
# Sur ton Mac de dev
git checkout -b feature/nouvelle-feature
# ... faire des modifs ...
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin feature/nouvelle-feature
```

### Review et merge

1. Créer une Pull Request sur GitHub
2. Review le code
3. Merge vers `main`

### Auto-deploy

**Automatiquement après le merge**:
1. GitHub envoie un webhook au Mac mini
2. Le deploy-server reçoit la notification
3. Git pull automatique
4. npm install
5. Redémarrage du serveur
6. Le jeu est à jour!

---

## 🎯 Architecture finale

```
┌─────────────────┐
│   GitHub Repo   │
│   (main branch) │
└────────┬────────┘
         │ push event
         ▼
┌─────────────────┐
│ GitHub Webhook  │
│ POST /webhook   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Mac Mini      │
│ deploy-server   │
│   Port 9000     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Déploiement     │
│ 1. git pull     │
│ 2. npm install  │
│ 3. restart      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Game Server    │
│   Port 3000     │
│  localhost:3000 │
└─────────────────┘
```

---

## ✅ Checklist finale

Avant de dire que c'est prêt:

- [ ] Secret webhook généré et configuré
- [ ] deploy-server.js fonctionne en standalone
- [ ] Service LaunchAgent installé et actif
- [ ] Port 9000 accessible depuis Internet (IP publique ou tunnel)
- [ ] GitHub webhook configuré et testé (ping OK)
- [ ] Test de push vers main → déploiement automatique
- [ ] Le jeu démarre correctement après déploiement
- [ ] Logs configurés et consultables
- [ ] Firewall macOS configuré

---

## 📚 Ressources

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [macOS LaunchAgent Guide](https://www.launchd.info/)
- [ngrok Documentation](https://ngrok.com/docs)

---

**🎉 Félicitations! Ton Mac mini est maintenant un serveur de déploiement continu comme Render.com!**

À chaque push sur GitHub, le jeu se met à jour automatiquement. 🚀
