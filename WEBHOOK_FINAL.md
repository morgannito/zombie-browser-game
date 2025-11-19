# ✅ Configuration GitHub Webhook - PRÊT

## 🎉 Validation réussie

```bash
curl http://82.65.123.20:9000/health
# ✅ {"status":"healthy","uptime":424,"deployServer":"running"}
```

Le deploy server est accessible depuis Internet !

---

## 📝 Configuration GitHub Webhook

### Étape 1 : Accéder aux webhooks

1. Va sur : https://github.com/morgannito/zombie-browser-game/settings/hooks
2. Clique sur **"Add webhook"**

### Étape 2 : Remplir le formulaire

Copie-colle exactement ces valeurs :

| Champ | Valeur à copier |
|-------|-----------------|
| **Payload URL** | `http://82.65.123.20:9000/webhook` |
| **Content type** | `application/json` |
| **Secret** | `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d` |

### Étape 3 : Configurer les événements

- ✅ **Which events would you like to trigger this webhook?**
  - Sélectionne : **"Just the push event"**

- ✅ **Active**
  - Coche la case

### Étape 4 : SSL Verification

⚠️ **Important** : Comme on utilise HTTP (pas HTTPS), GitHub va afficher un warning.

- Sélectionne : **"Disable SSL verification"** (temporaire, pour test)

### Étape 5 : Sauvegarder

Clique sur **"Add webhook"**

GitHub va envoyer un **ping test** immédiatement.

---

## 🧪 Vérifier le ping test

### Sur le Mac mini, surveille les logs :

```bash
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'
```

Tu devrais voir :
```
[2025-11-19T...] 🔔 Ping event from GitHub
```

### Vérifier dans GitHub :

1. Sur la page des webhooks : https://github.com/morgannito/zombie-browser-game/settings/hooks
2. Clique sur le webhook que tu viens de créer
3. Onglet **"Recent Deliveries"**
4. Le ping test doit afficher : ✅ **200 OK**

---

## 🚀 Test du déploiement automatique

### Faire un commit test :

```bash
cd /Users/mriu/Downloads/zombie-jeu-claude-zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA

# Créer un fichier test
echo "Test auto-deploy $(date)" > AUTO_DEPLOY_TEST.txt

git add AUTO_DEPLOY_TEST.txt
git commit -m "test: vérification auto-deploy"
git push origin main
```

### Surveiller le déploiement :

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

### Vérifier dans GitHub :

Webhook → Recent Deliveries → Dernier push → ✅ **200 OK**

---

## 📊 URLs de ton installation

| Service | URL | Accessible de |
|---------|-----|---------------|
| **Game (local)** | http://192.168.50.68:3001 | Réseau local |
| **Game (public)** | ⚠️ Pas exposé | - |
| **Deploy webhook** | http://82.65.123.20:9000/webhook | Internet |
| **Health check** | http://82.65.123.20:9000/health | Internet |

---

## 🎯 Workflow final

```
┌─────────────┐
│  Local Dev  │
│   (MacBook) │
└──────┬──────┘
       │ git push
       ▼
┌─────────────┐
│   GitHub    │
└──────┬──────┘
       │ POST /webhook (signature HMAC-SHA256)
       ▼
┌─────────────────────────┐
│   Mac mini Deploy       │
│   82.65.123.20:9000     │
│                         │
│  1. Vérifier signature  │
│  2. git pull            │
│  3. npm install         │
│  4. kill old server     │
│  5. start new server    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   Game Server           │
│   192.168.50.68:3001    │
│   ✅ UPDATED!           │
└─────────────────────────┘
```

---

## 🔒 Sécurité (TODO pour production)

Pour la production, il faudra :

1. **HTTPS avec certificat SSL** :
   - Installer nginx comme reverse proxy
   - Obtenir certificat Let's Encrypt gratuit
   - Webhook GitHub → `https://ton-domaine.com/webhook`

2. **Rate limiting** :
   - Protection contre spam webhooks

3. **Firewall strict** :
   - Autoriser uniquement les IPs GitHub
   - Liste : https://api.github.com/meta

4. **Monitoring** :
   - Alertes en cas d'échec de déploiement

---

## 🎉 C'est terminé !

Ton Mac mini est maintenant un **serveur CI/CD comme Render.com** !

**Dès que tu push sur GitHub → le jeu se met à jour automatiquement sur le Mac mini** 🚀

---

## 📋 Commandes utiles

```bash
# Voir les logs en temps réel
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'

# Redémarrer deploy server
ssh mac-mini 'launchctl stop com.zombiegame.deploy && launchctl start com.zombiegame.deploy'

# Redémarrer game server
ssh mac-mini 'launchctl stop com.zombiegame.game && launchctl start com.zombiegame.game'

# Vérifier l'état des services
ssh mac-mini 'launchctl list | grep zombiegame'

# Health check
curl http://82.65.123.20:9000/health
```
