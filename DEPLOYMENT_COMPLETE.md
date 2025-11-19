# 🎉 Déploiement Auto-Deploy Terminé !

## ✅ Installation complète validée

```
✅ Mac mini (192.168.50.68)
   - Node.js v24.11.1 installé via nvm
   - Deploy server actif sur port 9000
   - Game server actif sur port 3001
   - Auto-start au boot configuré

✅ Serveur nginx (192.168.50.38)
   - nginx 1.24.0 installé
   - Reverse proxy configuré
   - Certificat SSL Let's Encrypt obtenu
   - HTTPS actif avec redirection automatique

✅ DNS
   - zombie.lonewolf.fr → 82.65.123.20 ✅
   - Propagation validée

✅ Tests
   - HTTP → HTTPS redirect : ✅
   - HTTPS health check : ✅
   - Reverse proxy : ✅
   - Deploy server : ✅ (uptime 47min)
```

---

## 📊 Architecture finale

```
GitHub Push
    ↓
https://zombie.lonewolf.fr/webhook (HTTPS SSL)
    ↓
nginx 192.168.50.38:443 (reverse proxy)
    ↓
Mac mini 192.168.50.68:9000 (deploy server)
    ↓
git pull + npm install + restart
    ↓
Game server port 3001 mis à jour
```

---

## 🔐 Configuration GitHub Webhook (dernière étape !)

### 1. Accéder aux webhooks GitHub

https://github.com/morgannito/zombie-browser-game/settings/hooks

### 2. Créer le webhook

Clique sur **"Add webhook"** et remplis :

| Champ | Valeur |
|-------|--------|
| **Payload URL** | `https://zombie.lonewolf.fr/webhook` |
| **Content type** | `application/json` |
| **Secret** | `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d` |
| **SSL verification** | ✅ **Enable SSL verification** |
| **Which events** | ✅ Just the push event |
| **Active** | ✅ Coché |

### 3. Sauvegarder

Clique sur **"Add webhook"**

GitHub enverra un **ping test** automatiquement.

---

## 🧪 Test du webhook

### Test 1 : Vérifier le ping de GitHub

1. Dans GitHub : Settings → Webhooks → Ton webhook → **Recent Deliveries**
2. Le ping test doit afficher : ✅ **200 OK**

### Test 2 : Faire un push test

```bash
cd /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA

echo "Test auto-deploy $(date)" >> README.md
git add README.md
git commit -m "test: validation système auto-deploy"
git push origin main
```

### Test 3 : Surveiller le déploiement

**Sur le Mac mini :**
```bash
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'
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

**Dans GitHub :**
- Settings → Webhooks → Recent Deliveries
- Dernier push : ✅ **200 OK**

---

## 🎯 URLs finales

| Service | URL | Sécurisé |
|---------|-----|----------|
| **Webhook GitHub** | `https://zombie.lonewolf.fr/webhook` | ✅ HTTPS |
| **Health check** | `https://zombie.lonewolf.fr/health` | ✅ HTTPS |
| **Game (local)** | `http://192.168.50.68:3001` | ⚠️ HTTP local |

---

## 📋 Commandes utiles

### Surveillance

```bash
# Logs deploy en temps réel
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'

# Logs nginx
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo tail -f /var/log/nginx/access.log'
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo tail -f /var/log/nginx/error.log'

# Health check
curl https://zombie.lonewolf.fr/health
```

### Gestion des services

**Mac mini :**
```bash
# Redémarrer deploy server
ssh mac-mini 'launchctl stop com.zombiegame.deploy && launchctl start com.zombiegame.deploy'

# Redémarrer game server
ssh mac-mini 'launchctl stop com.zombiegame.game && launchctl start com.zombiegame.game'

# Vérifier l'état
ssh mac-mini 'launchctl list | grep zombiegame'
ssh mac-mini 'lsof -i:9000 -i:3001'
```

**Serveur nginx :**
```bash
# Redémarrer nginx
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo systemctl restart nginx'

# Vérifier nginx
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo nginx -t'
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo systemctl status nginx'
```

---

## 🔒 Sécurité et maintenance

### Certificat SSL

- ✅ **Valide jusqu'au** : 2026-02-17
- ✅ **Renouvellement automatique** : Configuré par certbot
- Test renouvellement : `ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo certbot renew --dry-run'`

### Backups recommandés

```bash
# Backup deploy server config (Mac mini)
ssh mac-mini 'tar -czf ~/deploy-backup-$(date +%Y%m%d).tar.gz ~/zombie-browser-game/{deploy-server.js,.env.deploy.local,com.zombiegame.deploy.plist}'

# Backup nginx config
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo tar -czf ~/nginx-backup-$(date +%Y%m%d).tar.gz /etc/nginx/sites-available/zombie.lonewolf.fr /etc/letsencrypt/live/zombie.lonewolf.fr'
```

---

## 🔧 Troubleshooting

### Le webhook ne fonctionne pas

```bash
# 1. Vérifier que les deux serveurs tournent
ssh mac-mini 'lsof -i:9000 -i:3001'
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo systemctl status nginx'

# 2. Tester HTTPS manuellement
curl -v https://zombie.lonewolf.fr/health

# 3. Vérifier les logs
ssh mac-mini 'tail -50 ~/zombie-browser-game/deploy.log'
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo tail -50 /var/log/nginx/error.log'

# 4. Tester depuis GitHub
# Recent Deliveries → Redeliver
```

### Le déploiement échoue

```bash
# 1. Vérifier les logs détaillés
ssh mac-mini 'tail -100 ~/zombie-browser-game/deploy.log'

# 2. Vérifier git
ssh mac-mini 'cd ~/zombie-browser-game && git status && git log -1'

# 3. Vérifier npm
ssh mac-mini 'cd ~/zombie-browser-game && npm list'

# 4. Redémarrer manuellement
ssh mac-mini 'cd ~/zombie-browser-game && git pull && npm install && launchctl restart com.zombiegame.game'
```

### Certificat SSL expiré

```bash
# Forcer le renouvellement
ssh -i ~/.ssh/id_rsa toto@192.168.50.38 'sudo certbot renew --force-renewal'
```

---

## 📝 Récapitulatif des fichiers créés

### Mac mini (192.168.50.68)

```
~/zombie-browser-game/
├── deploy-server.js              # Serveur webhook
├── deploy-wrapper.sh             # Wrapper nvm pour LaunchAgent
├── game-wrapper.sh               # Wrapper nvm pour game server
├── .env.deploy.local             # Configuration (secret)
├── com.zombiegame.deploy.plist   # LaunchAgent deploy
├── com.zombiegame.game.plist     # LaunchAgent game
└── deploy.log                    # Logs déploiement
```

### Serveur nginx (192.168.50.38)

```
/etc/nginx/sites-available/zombie.lonewolf.fr  # Config nginx
/etc/letsencrypt/live/zombie.lonewolf.fr/      # Certificats SSL
```

### Repository local

```
DEPLOY_README.md          # Guide rapide
DEPLOY_SETUP.md           # Documentation complète
NGINX_REVERSE_PROXY.md    # Guide nginx
WEBHOOK_FINAL.md          # Config GitHub webhook
DEPLOYMENT_COMPLETE.md    # Ce fichier
BUG_FIXES_REPORT.md       # Rapport des 146 bugs corrigés
```

---

## 🎉 C'est terminé !

Ton Mac mini est maintenant un **serveur CI/CD production-ready** avec :

✅ **Auto-deploy** : Push sur GitHub → Mise à jour automatique
✅ **HTTPS SSL** : Certificat Let's Encrypt valide
✅ **Reverse proxy** : nginx professionnel
✅ **Auto-start** : Redémarre au boot
✅ **Sécurisé** : Signature HMAC-SHA256 sur webhooks

**Dès que tu configures le webhook GitHub → le système est opérationnel !** 🚀

---

## 📞 Support

En cas de problème :

1. Consulte les logs : `ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'`
2. Vérifie les services : `ssh mac-mini 'launchctl list | grep zombiegame'`
3. Test manuel : `curl https://zombie.lonewolf.fr/health`

Le système est conçu pour être **robuste et auto-réparant**. Les LaunchAgents redémarrent automatiquement en cas de crash.
