# 🚀 Configuration finale du système auto-deploy

## ✅ Ce qui est fait

- [x] Deploy server créé et fonctionnel
- [x] Service LaunchAgent installé (auto-démarre au boot)
- [x] Secret webhook généré : `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d`
- [x] Documentation complète créée

## 🎯 Reste à faire (2 étapes - 5 min)

### 1. Exposer le serveur à Internet (choisis UNE option)

#### Option A - ngrok (recommandé pour tester)
```bash
# Installer
brew install ngrok

# Lancer
ngrok http 9000

# Tu recevras une URL type: https://abc123.ngrok.io
# Cette URL change à chaque redémarrage (version gratuite)
```

#### Option B - localtunnel (URL fixe gratuite)
```bash
# Installer
npm install -g localtunnel

# Lancer
lt --port 9000 --subdomain zombiegame

# URL fixe: https://zombiegame.loca.lt
```

#### Option C - IP publique (production)
```bash
# 1. Trouver ton IP
curl ifconfig.me

# 2. Configurer port forwarding sur ton routeur
#    Port externe 9000 → IP Mac mini port 9000

# 3. Autoriser Node.js dans le firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

### 2. Configurer GitHub webhook

1. Va sur ton repo GitHub
2. Settings → Webhooks → Add webhook
3. Configure :
   - **Payload URL** : `https://ton-tunnel-ou-ip:9000/webhook`
   - **Content type** : `application/json`
   - **Secret** : `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d`
   - **Events** : Just the push event
4. Save

### 3. Test !

```bash
# Faire un commit test
echo "# Test auto-deploy" >> README.md
git add .
git commit -m "test: auto deploy"
git push origin main

# Vérifier les logs
tail -f deploy.log
```

## 📊 Commandes utiles

```bash
# Voir les logs en temps réel
npm run deploy:logs

# Redémarrer le service
npm run deploy:restart

# Vérifier que tout tourne
lsof -i:9000  # Deploy server
lsof -i:3000  # Game server

# Health check
curl http://localhost:9000/health
```

## 🎉 C'est tout !

Ton Mac mini est maintenant un serveur CI/CD comme Render.com.

**Workflow final :**
```
git push → GitHub webhook → Mac mini → Auto-deploy ✨
```
