# 🔒 Configuration nginx Reverse Proxy sur 192.168.50.38

## 📋 Architecture

```
Internet (GitHub)
    ↓
zombie.lonewolf.fr → 192.168.50.38:443 (nginx reverse proxy)
    ↓
192.168.50.68:9000 (Mac mini deploy server)
```

---

## Étape 1 : Configuration DNS

### Ajouter l'enregistrement A pour zombie.lonewolf.fr

Dans la config DNS de `lonewolf.fr` :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| **A** | `zombie` | **IP publique du serveur 192.168.50.38** | 3600 |

⚠️ **Important** : Utilise l'IP publique du serveur 192.168.50.38 (pas celle du Mac mini)

Vérifier :
```bash
dig zombie.lonewolf.fr +short
# Doit retourner l'IP publique de 192.168.50.38
```

---

## Étape 2 : Se connecter au serveur nginx

```bash
ssh toto@192.168.50.38
# Password: toto
```

---

## Étape 3 : Vérifier nginx

### 3.1 Vérifier si nginx est installé

```bash
which nginx
nginx -v
```

### 3.2 Si nginx n'est pas installé

**Sur Debian/Ubuntu :**
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

**Sur CentOS/RHEL :**
```bash
sudo yum install epel-release -y
sudo yum install nginx certbot python3-certbot-nginx -y
```

---

## Étape 4 : Configuration nginx reverse proxy

### 4.1 Créer la configuration pour zombie.lonewolf.fr

```bash
sudo tee /etc/nginx/sites-available/zombie.lonewolf.fr << 'EOF'
# Configuration HTTP initiale (avant SSL)
server {
    listen 80;
    server_name zombie.lonewolf.fr;

    # Permettre à certbot de valider le domaine
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Reverse proxy vers Mac mini deploy server
    location / {
        proxy_pass http://192.168.50.68:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts pour webhooks
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
```

### 4.2 Activer la configuration

```bash
# Créer le lien symbolique
sudo ln -sf /etc/nginx/sites-available/zombie.lonewolf.fr \
            /etc/nginx/sites-enabled/

# Créer dossier pour certbot
sudo mkdir -p /var/www/certbot
```

### 4.3 Tester et recharger nginx

```bash
# Tester la config
sudo nginx -t

# Recharger nginx
sudo systemctl reload nginx
# ou
sudo service nginx reload
```

### 4.4 Vérifier que le reverse proxy fonctionne

```bash
# Depuis le serveur nginx
curl http://zombie.lonewolf.fr/health

# Depuis ta machine locale
curl http://zombie.lonewolf.fr/health
```

Tu devrais voir : `{"status":"healthy","uptime":...}`

---

## Étape 5 : Obtenir le certificat SSL

### 5.1 Utiliser certbot

```bash
sudo certbot --nginx -d zombie.lonewolf.fr
```

Certbot va :
1. Valider que tu contrôles le domaine
2. Obtenir le certificat SSL
3. Configurer automatiquement nginx pour HTTPS
4. Configurer le renouvellement automatique

Réponds aux questions :
- Email : ton-email@exemple.com
- Agree to terms : Yes
- Share email : No
- Redirect HTTP to HTTPS : Yes (recommandé)

### 5.2 Vérifier le certificat

```bash
sudo certbot certificates
```

### 5.3 Tester HTTPS

```bash
curl https://zombie.lonewolf.fr/health
```

---

## Étape 6 : Configuration finale nginx (si certbot n'a pas tout fait)

Si certbot n'a pas configuré HTTPS automatiquement :

```bash
sudo tee /etc/nginx/sites-available/zombie.lonewolf.fr << 'EOF'
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

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name zombie.lonewolf.fr;

    # Certificats SSL (certbot les a créés)
    ssl_certificate /etc/letsencrypt/live/zombie.lonewolf.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zombie.lonewolf.fr/privkey.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS (optionnel mais recommandé)
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Reverse proxy vers Mac mini
    location / {
        proxy_pass http://192.168.50.68:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx
```

---

## Étape 7 : Renouvellement automatique SSL

Certbot configure automatiquement le renouvellement. Vérifier :

```bash
# Tester le renouvellement (dry-run)
sudo certbot renew --dry-run

# Voir la cron job
sudo systemctl list-timers | grep certbot
# ou
sudo crontab -l
```

---

## Étape 8 : Configuration Firewall (si actif)

### Sur le serveur nginx (192.168.50.38)

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Vérifier
sudo ufw status
# ou
sudo firewall-cmd --list-all
```

### Port forwarding routeur

Modifier le port forwarding pour pointer vers **192.168.50.38** :

| Port externe | IP interne | Port interne | Protocol |
|--------------|------------|--------------|----------|
| **80** | **192.168.50.38** | **80** | TCP |
| **443** | **192.168.50.38** | **443** | TCP |

⚠️ **Retirer** l'ancien forwarding du port 9000 vers le Mac mini si tu veux que tout passe par nginx.

---

## Étape 9 : Configuration GitHub Webhook

### 9.1 Modifier le webhook

1. Va sur : https://github.com/morgannito/zombie-browser-game/settings/hooks
2. Clique sur le webhook existant
3. Modifie :

| Champ | Nouvelle valeur |
|-------|-----------------|
| **Payload URL** | `https://zombie.lonewolf.fr/webhook` |
| **Content type** | `application/json` |
| **Secret** | `302864d79c669df7a5d0c4f3db795a89c1e8f063c484390adb1716da6a72116d` |
| **SSL verification** | ✅ **Enable SSL verification** |

### 9.2 Tester le webhook

```bash
# Faire un commit test
echo "Test HTTPS webhook via nginx $(date)" >> README.md
git add README.md
git commit -m "test: HTTPS webhook via nginx reverse proxy"
git push origin main
```

### 9.3 Surveiller les logs

**Sur le Mac mini** (deploy server) :
```bash
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'
```

Tu devrais voir :
```
[timestamp] 🔔 Push detected by morgannito
[timestamp] 🚀 Starting deployment...
```

**Sur le serveur nginx** :
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 📊 Architecture finale

```
GitHub Webhook
    ↓
https://zombie.lonewolf.fr (HTTPS SSL)
    ↓
Serveur nginx 192.168.50.38:443
    ↓ (reverse proxy)
Mac mini 192.168.50.68:9000
    ↓
Auto-deploy du jeu sur port 3001
```

---

## 🎯 URLs finales

| Service | URL | Sécurisé |
|---------|-----|----------|
| **Webhook GitHub** | `https://zombie.lonewolf.fr/webhook` | ✅ HTTPS |
| **Health check** | `https://zombie.lonewolf.fr/health` | ✅ HTTPS |
| **Game (local)** | `http://192.168.50.68:3001` | ⚠️ HTTP local |

---

## 🔧 Troubleshooting

### Le reverse proxy ne fonctionne pas

```bash
# Vérifier que nginx tourne
sudo systemctl status nginx

# Vérifier la config
sudo nginx -t

# Voir les logs
sudo tail -f /var/log/nginx/error.log

# Vérifier la connectivité vers le Mac mini
curl http://192.168.50.68:9000/health
```

### Certificat SSL pas obtenu

```bash
# Vérifier le DNS
dig zombie.lonewolf.fr +short

# Vérifier que le port 80 est ouvert
curl http://zombie.lonewolf.fr

# Réessayer certbot
sudo certbot --nginx -d zombie.lonewolf.fr --verbose
```

### Le webhook GitHub échoue

```bash
# Vérifier les logs nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Vérifier le deploy server sur Mac mini
ssh mac-mini 'lsof -i:9000'
ssh mac-mini 'tail -f ~/zombie-browser-game/deploy.log'

# Tester manuellement
curl -X POST https://zombie.lonewolf.fr/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen":"test"}'
```

---

## 📋 Checklist complète

Sur le serveur nginx (192.168.50.38) :
- [ ] nginx installé
- [ ] Configuration reverse proxy créée
- [ ] nginx rechargé et fonctionne
- [ ] Test HTTP : `curl http://zombie.lonewolf.fr/health`
- [ ] Certificat SSL obtenu avec certbot
- [ ] Test HTTPS : `curl https://zombie.lonewolf.fr/health`
- [ ] Firewall configuré (ports 80, 443)

DNS et réseau :
- [ ] DNS configuré (`zombie.lonewolf.fr` → IP publique de 192.168.50.38)
- [ ] Port forwarding routeur (80, 443 → 192.168.50.38)

GitHub :
- [ ] Webhook mis à jour avec `https://zombie.lonewolf.fr/webhook`
- [ ] SSL verification activée
- [ ] Test avec git push

---

🎉 Une fois terminé, le système sera **production-ready** avec HTTPS !
