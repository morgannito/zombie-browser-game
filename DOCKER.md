# Docker Deployment Guide

## Requirements

- **Docker:** 20.10+
- **Docker Compose:** 2.0+
- **Node.js in container:** 20.x LTS (requis par better-sqlite3 v12.4.1)

---

## Quick Start

### Build et démarrer avec Docker Compose (Recommandé)

```bash
# Build et démarrer
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart
```

Le serveur sera accessible sur http://localhost:3000

---

## Commandes Docker

### Build manuel

```bash
# Build l'image
docker build -t zombie-game .

# Lancer le container
docker run -d \
  --name zombie-game \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=production \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  zombie-game
```

### Gestion du container

```bash
# Status
docker ps

# Logs
docker logs zombie-game -f

# Arrêter
docker stop zombie-game

# Redémarrer
docker restart zombie-game

# Supprimer
docker rm zombie-game

# Supprimer l'image
docker rmi zombie-game
```

---

## Health Check

Le container inclut un health check automatique:

```bash
# Vérifier le status
docker inspect --format='{{.State.Health.Status}}' zombie-game

# Voir les détails
docker inspect zombie-game | grep -A 10 Health
```

Health check endpoint: http://localhost:3000/health

---

## Volumes Persistants

Les données sont sauvegardées localement dans:

- `./data/` - Base de données SQLite (game.db)
- `./logs/` - Logs Winston (error.log, combined.log)

**Important:** Ne pas supprimer ces dossiers pour conserver vos données entre redémarrages.

---

## Variables d'Environnement

### Dans docker-compose.yml

```yaml
environment:
  - NODE_ENV=production          # Mode production
  - PORT=3000                    # Port serveur
  - DB_PATH=/app/data/game.db    # Chemin base de données
  - LOG_DIR=/app/logs            # Dossier logs
  - LOG_LEVEL=info               # Niveau logs (debug|info|warn|error)
  - ALLOWED_ORIGINS=http://localhost:3000  # CORS origins
```

### Modifier les origins CORS

Pour autoriser d'autres domaines:

```yaml
- ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Troubleshooting

### Container ne démarre pas

```bash
# Voir les logs d'erreur
docker logs zombie-game

# Vérifier les permissions des volumes
ls -la data/ logs/

# Reconstruire l'image
docker-compose build --no-cache
docker-compose up -d
```

### Better-sqlite3 compilation errors

Le Dockerfile installe automatiquement les outils de compilation (python3, make, g++).

Si erreur:
```bash
# Rebuild complet
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Base de données corrompue

```bash
# Backup
cp data/game.db data/game.db.backup

# Supprimer et recréer
rm data/game.db
docker-compose restart
```

### Port 3000 déjà utilisé

Modifier le port dans docker-compose.yml:
```yaml
ports:
  - "8080:3000"  # Accessible sur http://localhost:8080
```

---

## Performance

### Modes de Performance

Le serveur propose 4 modes de performance adaptés à différentes configurations:

| Mode | FPS | Max Zombies | Max Players | Max Power-ups | Recommandation |
|------|-----|-------------|-------------|---------------|----------------|
| **high** | 60 | 200 | 50 | 20 | Serveurs puissants (2+ CPU cores, 2GB+ RAM) |
| **balanced** | 45 | 150 | 30 | 15 | Configuration par défaut (1-2 cores, 1GB RAM) |
| **low-memory** | 30 | 100 | 20 | 10 | VPS économiques (1 core, 512MB RAM) |
| **minimal** | 20 | 50 | 10 | 5 | Ressources très limitées |

### Configuration du Mode

#### Docker Compose

Modifier `PERFORMANCE_MODE` dans docker-compose.yml:

```yaml
environment:
  - PERFORMANCE_MODE=low-memory  # Pour serveur avec peu de RAM
```

#### Manuel

```bash
docker run -e PERFORMANCE_MODE=low-memory zombie-game
```

### Ressources recommandées

#### Mode Balanced (défaut)
- **CPU:** 1 core minimum, 2 cores recommandé
- **RAM:** 512MB minimum, 1GB recommandé
- **Disk:** 1GB pour app + logs + database

#### Mode Low-Memory
- **CPU:** 1 core
- **RAM:** 512MB (avec swap recommandé)
- **Disk:** 500MB minimum

### Limiter les ressources

Dans docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Garbage Collection Forcé

En mode `low-memory`, le serveur force le garbage collection toutes les 30s.

Démarrer avec GC activé:
```bash
docker run --init -e PERFORMANCE_MODE=low-memory zombie-game
```

Ou avec Node.js flag:
```dockerfile
CMD ["node", "--expose-gc", "server.js"]
```

---

## Production Deployment

### Recommandations

1. **Variables d'environnement:**
   ```yaml
   - NODE_ENV=production
   - LOG_LEVEL=warn
   - ALLOWED_ORIGINS=https://votredomaine.com
   ```

2. **Volumes persistants:**
   - Utiliser des volumes nommés pour meilleure performance
   - Sauvegarder régulièrement `data/game.db`

3. **Reverse proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name votredomaine.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

4. **SSL/TLS:**
   - Utiliser Let's Encrypt avec certbot
   - Configurer HTTPS dans le reverse proxy

5. **Monitoring:**
   ```bash
   # Stats en temps réel
   docker stats zombie-game

   # Logs de production
   docker logs zombie-game --since 1h
   ```

---

## Backup & Restore

### Backup

```bash
# Backup automatique quotidien
docker exec zombie-game sh -c 'cp /app/data/game.db /app/data/game-backup-$(date +%Y%m%d).db'

# Backup manuel
docker cp zombie-game:/app/data/game.db ./backup/game-$(date +%Y%m%d).db
```

### Restore

```bash
# Arrêter le serveur
docker-compose stop

# Restaurer la base
cp backup/game-20250118.db data/game.db

# Redémarrer
docker-compose start
```

---

## Multi-Stage Build (Optimisation)

Pour une image plus légère, modifier le Dockerfile:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install --production

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/data /app/logs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

---

**Documentation mise à jour:** 2025-11-18
**Docker support:** Production-ready ✅
