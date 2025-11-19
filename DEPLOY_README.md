# 🚀 Auto-Deploy - Guide Rapide

Système de déploiement automatique style Render.com pour Mac mini.

---

## ⚡ Installation Rapide (5 minutes)

```bash
# 1. Exécuter le script de setup
./setup-deploy.sh

# 2. Exposer le serveur (choisir une option)

# Option A - Tunnel ngrok (test)
brew install ngrok
ngrok http 9000

# Option B - Localtunnel (gratuit permanent)
npm install -g localtunnel
lt --port 9000 --subdomain zombiegame

# 3. Configurer GitHub webhook
# URL: https://ton-tunnel.ngrok.io/webhook  (ou ton URL)
# Secret: (celui affiché par setup-deploy.sh)
# Event: Just the push event

# 4. Test!
git add .
git commit -m "test: auto deploy"
git push origin main
```

---

## 📦 Fichiers créés

| Fichier | Description |
|---------|-------------|
| `deploy-server.js` | Serveur qui écoute les webhooks GitHub |
| `.env.deploy` | Template de configuration |
| `.env.deploy.local` | Configuration locale (secrets) |
| `com.zombiegame.deploy.plist` | Service macOS (LaunchAgent) |
| `setup-deploy.sh` | Script d'installation automatique |
| `DEPLOY_SETUP.md` | Documentation complète |

---

## 🎯 Commandes Utiles

```bash
# Démarrer le serveur manuellement
npm run deploy:server

# Installer le service (auto-start au boot)
npm run deploy:install

# Voir les logs
npm run deploy:logs

# Redémarrer le service
npm run deploy:restart

# Désinstaller le service
npm run deploy:uninstall
```

---

## 🔧 Workflow

```
Push GitHub → Webhook → Mac Mini → Deploy automatique
     ↓            ↓           ↓              ↓
   main      port 9000   deploy.js    pull + restart
```

### Ce qui se passe automatiquement:

1. Tu push sur GitHub (branche `main`)
2. GitHub envoie un webhook au Mac mini
3. Le deploy-server vérifie la signature
4. Pull automatique des derniers changements
5. `npm install` si besoin
6. Redémarrage du serveur game
7. Le jeu est à jour! 🎉

---

## 🌐 Options d'exposition

### 1. Tunnel ngrok (test/dev)

**Avantages**:
- ✅ Facile à setup
- ✅ HTTPS inclus
- ✅ URL aléatoire sécurisée

**Inconvénients**:
- ❌ URL change à chaque redémarrage (version gratuite)
- ❌ Limité à 20 connexions/min

```bash
brew install ngrok
ngrok http 9000
# URL: https://abc123.ngrok.io
```

### 2. Localtunnel (gratuit permanent)

**Avantages**:
- ✅ Gratuit illimité
- ✅ Subdomain personnalisé possible
- ✅ HTTPS inclus

**Inconvénients**:
- ❌ Peut être instable
- ❌ Page de warning

```bash
npm install -g localtunnel
lt --port 9000 --subdomain zombiegame
# URL: https://zombiegame.loca.lt
```

### 3. IP publique (production)

**Avantages**:
- ✅ Contrôle total
- ✅ Stable
- ✅ Pas de middleman

**Inconvénients**:
- ❌ Configuration réseau requise
- ❌ Certificat SSL à gérer

```bash
# 1. Obtenir ton IP publique
curl ifconfig.me

# 2. Configurer port forwarding sur routeur
# Port externe: 9000 → IP Mac mini: port 9000

# 3. Configurer firewall macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node

# 4. URL webhook GitHub
# http://ton-ip-publique:9000/webhook
```

---

## 🧪 Tests

### Test 1: Health check

```bash
curl http://localhost:9000/health
```

Attendu:
```json
{
  "status": "healthy",
  "uptime": 123,
  "deployServer": "running"
}
```

### Test 2: Déploiement manuel

```bash
# Récupère ton secret dans .env.deploy.local
SECRET="ton-secret-ici"

curl -X POST http://localhost:9000/deploy \
  -H "Authorization: Bearer $SECRET"
```

### Test 3: Simulation webhook GitHub

```bash
# Copie le secret du fichier .env.deploy.local
SECRET="ton-secret"

# Générer la signature
PAYLOAD='{"ref":"refs/heads/main","pusher":{"name":"test"},"commits":[]}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"

# Envoyer le webhook
curl -X POST http://localhost:9000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

## 📊 Monitoring

### Logs en temps réel

```bash
# Tous les logs
tail -f deploy.log

# Stdout du service
tail -f deploy-stdout.log

# Stderr du service
tail -f deploy-stderr.log

# Logs du jeu
tail -f server.log
```

### Vérifier que tout tourne

```bash
# Deploy server (port 9000)
lsof -i:9000

# Game server (port 3000)
lsof -i:3000

# Processus
ps aux | grep deploy-server
ps aux | grep "node server.js"
```

---

## 🔐 Sécurité

### ✅ Ce qui est fait

- Signature webhook vérifiée (HMAC-SHA256)
- Secret fort (32 bytes random)
- `.env.deploy.local` dans .gitignore
- Authentification sur endpoint `/deploy`

### ⚠️ À faire en production

- [ ] HTTPS (reverse proxy nginx + Let's Encrypt)
- [ ] Rate limiting sur webhooks
- [ ] IP whitelist (GitHub IPs only)
- [ ] Firewall strict

---

## ❓ FAQ

**Q: Le webhook ne reçoit rien**

R: Vérifie:
1. Le tunnel est actif: `lsof -i:9000`
2. L'URL webhook dans GitHub settings
3. Les logs: `tail -f deploy.log`

**Q: La signature est invalide**

R: Vérifie:
1. Le secret est identique dans GitHub ET `.env.deploy.local`
2. Pas d'espaces ou caractères bizarres dans le secret

**Q: Le déploiement échoue**

R: Vérifie:
1. Git est configuré: `git config user.name`
2. Permissions: `git pull origin main` fonctionne
3. Les logs: `tail -f deploy.log`

**Q: Le jeu ne redémarre pas**

R:
```bash
# Kill tous les node
pkill -9 node

# Redémarre manuellement
npm start

# Vérifie
lsof -i:3000
```

---

## 📚 Documentation complète

Pour plus de détails: **[DEPLOY_SETUP.md](./DEPLOY_SETUP.md)**

---

**🎉 C'est tout! Ton Mac mini est maintenant un serveur CI/CD comme Render.com!**
