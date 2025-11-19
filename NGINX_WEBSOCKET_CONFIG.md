# 🔧 Configuration nginx pour WebSocket avec Cloudflare

## ⚠️ Problèmes identifiés

1. **Timeouts trop courts** : 60s n'est pas suffisant pour WebSocket (connexion longue durée)
2. **Headers WebSocket manquants** : besoin de headers spécifiques pour Socket.IO
3. **Cloudflare proxy** : besoin de configuration spéciale

---

## 📝 Configuration nginx recommandée

### Remplacer `/etc/nginx/sites-available/zombie.lonewolf.fr` avec :

```nginx
# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name zombie.lonewolf.fr;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuration HTTPS avec support WebSocket
server {
    listen 443 ssl http2;
    server_name zombie.lonewolf.fr;

    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/zombie.lonewolf.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zombie.lonewolf.fr/privkey.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Headers pour Cloudflare
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

    # Reverse proxy vers Mac mini avec support WebSocket
    location / {
        proxy_pass http://192.168.50.68:9000;
        proxy_http_version 1.1;

        # Headers essentiels pour WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers standards
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Headers spécifiques Cloudflare
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_set_header CF-RAY $http_cf_ray;
        proxy_set_header CF-Visitor $http_cf_visitor;

        # Désactiver la mise en cache pour WebSocket
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache 1;

        # Timeouts LONGS pour WebSocket (connexions persistantes)
        proxy_connect_timeout 7200s;
        proxy_send_timeout 7200s;
        proxy_read_timeout 7200s;

        # Buffers
        proxy_buffering off;
        proxy_buffer_size 4k;
        proxy_buffers 4 4k;
        proxy_busy_buffers_size 8k;
    }

    # Location spécifique pour Socket.IO
    location /socket.io/ {
        proxy_pass http://192.168.50.68:9000;
        proxy_http_version 1.1;

        # Headers WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers standards
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts très longs pour Socket.IO
        proxy_connect_timeout 7200s;
        proxy_send_timeout 7200s;
        proxy_read_timeout 7200s;

        # Désactiver buffers pour Socket.IO
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔧 Étapes de configuration

### 1. Sur le serveur nginx (192.168.50.38)

```bash
# Se connecter au serveur
ssh toto@192.168.50.38

# Backup de l'ancienne config
sudo cp /etc/nginx/sites-available/zombie.lonewolf.fr \
        /etc/nginx/sites-available/zombie.lonewolf.fr.backup

# Éditer la configuration
sudo nano /etc/nginx/sites-available/zombie.lonewolf.fr
# (Coller la nouvelle configuration ci-dessus)

# Tester la configuration
sudo nginx -t

# Si OK, recharger nginx
sudo systemctl reload nginx

# Vérifier les logs
sudo tail -f /var/log/nginx/error.log
```

### 2. Configuration Cloudflare

1. Aller sur le dashboard Cloudflare pour `lonewolf.fr`
2. Vérifier les paramètres :

#### Network
- **WebSockets** : ✅ ON (activé par défaut)
- **HTTP/2** : ✅ ON

#### SSL/TLS
- **Mode** : Full (strict) ⚠️ IMPORTANT !
- Pas "Flexible" sinon ça va casser

#### Speed
- **Brotli** : ✅ ON
- **Rocket Loader** : ❌ OFF (peut casser les WebSockets)
- **Auto Minify** : JavaScript ❌ OFF

### 3. Vérification du port

Cloudflare supporte WebSocket seulement sur ces ports :
- ✅ **443** (HTTPS) ← Vous utilisez celui-ci, c'est bon !
- ✅ 80, 8080, 8880
- ✅ 2052, 2053, 2082, 2083, 2086, 2087, 2095, 2096

Votre configuration utilise le port 443, donc c'est parfait.

---

## 🧪 Tests

### Test 1 : Vérifier que nginx accepte la config
```bash
sudo nginx -t
```

### Test 2 : Test HTTP basique
```bash
curl https://zombie.lonewolf.fr/health
```

### Test 3 : Test WebSocket avec websocat (optionnel)
```bash
# Installer websocat
sudo apt install websocat

# Tester WebSocket
websocat wss://zombie.lonewolf.fr/socket.io/\?EIO=4\&transport=websocket
```

### Test 4 : Vérifier les logs en temps réel
```bash
# Terminal 1 : logs nginx
sudo tail -f /var/log/nginx/access.log

# Terminal 2 : logs nginx erreurs
sudo tail -f /var/log/nginx/error.log

# Terminal 3 : logs de votre app
ssh mac-mini 'pm2 logs zombie-game'
```

---

## 🔍 Diagnostic

### Si ça ne marche toujours pas :

```bash
# 1. Vérifier que le serveur Node.js écoute bien
ssh mac-mini 'netstat -tlnp | grep 9000'

# 2. Vérifier la connexion nginx → backend
curl -I http://192.168.50.68:9000/health

# 3. Voir les headers Cloudflare
curl -I https://zombie.lonewolf.fr/health

# 4. Tester sans Cloudflare (temporairement)
# Sur Cloudflare : DNS → zombie → Désactiver le proxy (nuage gris)
# Tester : wss://zombie.lonewolf.fr
# Réactiver le proxy après
```

---

## 🎯 Points clés

1. **Timeouts** : Passés de 60s à 7200s (2h) pour WebSocket
2. **Headers Cloudflare** : Ajout de `CF-Connecting-IP`, `CF-RAY`, etc.
3. **Buffering désactivé** : Important pour WebSocket temps réel
4. **Location `/socket.io/`** : Configuration spécifique Socket.IO
5. **Mode SSL Cloudflare** : DOIT être "Full (strict)"

---

## ⚡ Redémarrage du serveur Node.js

Après avoir changé nginx, redémarrer aussi le serveur Node.js :

```bash
ssh mac-mini

# Si vous utilisez pm2
pm2 restart zombie-game

# Si vous utilisez node directement
# Tuer le processus et relancer
pkill -f "node.*server.js"
node server.js
```

---

## 📊 Architecture finale

```
Client Browser (wss://zombie.lonewolf.fr)
    ↓
Cloudflare Proxy (WebSocket ON)
    ↓
nginx 192.168.50.38:443 (reverse proxy WebSocket)
    ↓
Node.js 192.168.50.68:9000 (Socket.IO)
```

---

✅ Avec cette configuration, les WebSockets devraient fonctionner correctement via Cloudflare !
