# Zombie Multiplayer Game

[![CI](https://github.com/morgannito/zombie-browser-game/actions/workflows/ci.yml/badge.svg)](https://github.com/morgannito/zombie-browser-game/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Jeu de survie zombie multijoueur en temps reel, type rogue-like avec progression permanente. Jusqu'a 20 joueurs simultanes, 60 FPS, vagues de zombies avec boss, systeme d'ameliorations et classement persistant.

**Stack:** Node.js, Express, Socket.IO, SQLite, Canvas HTML5, Clean Architecture

## Features

- Multijoueur temps reel (Socket.IO, delta compression, session recovery 5min)
- Gameplay rogue-like : vagues, boss, power-ups, 4 types d'armes
- Progression permanente : XP, ameliorations, achievements, leaderboard JWT
- Clean Architecture stricte : Domain / Application / Infrastructure
- Observabilite : metriques Prometheus, overlay F3 (FPS/latence/entites), CPU profiling, heap snapshot
- DevOps : Docker multi-stage, PM2, CI/CD GitHub Actions, Fly.io / Railway / Render

## Quick Start

**Prerequisites:** Node.js 20+

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET (see comments inside)

# 3. Start the server
npm start
```

| Service | URL |
|---------|-----|
| Game (HTTP) | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| Metrics API | http://localhost:3000/api/v1/metrics |

The SQLite database and schema are created automatically on first launch.

```bash
# Development (auto-reload)
npm run dev

# Run tests
npm test

# Check server health
npm run health
```

## Architecture

Le projet suit une Clean Architecture avec separation stricte des couches. Les dependances pointent vers l'interieur (Infrastructure -> Application -> Domain).

```
zombie-multiplayer-game/
├── server.js          # Express + Socket.IO
├── lib/
│   ├── domain/        # Entites, repositories (interfaces), DomainErrors
│   ├── application/   # Container DI, 10 use-cases, services
│   ├── infrastructure/# SQLite repos, JwtService, Joi, Winston, Metrics
│   ├── database/      # DatabaseManager (WAL, migrations, backup)
│   └── server/        # Managers: Entity, Collision(Quadtree), Network, Room, Zombie
├── game/              # gameLoop (60 FPS), gameState, modules/ (zombie/bullet/wave/player)
├── public/            # Canvas HTML5 — modules/core|managers|systems|game|rendering
├── assets/            # manifest.json + PNG/SVG par categorie
└── __tests__/         # Jest (domain, application, game, lib)
```

## Debug

```bash
# Overlay perf client (FPS, latence, entites) — appuyer sur F3 en jeu

# Mode debug serveur (logs verbeux + metriques etendues)
ADMIN_DEBUG=true npm run dev
```

## API REST

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Authentification JWT |
| GET | `/health` | Health check + metriques systeme |
| GET | `/api/metrics` | Metriques Prometheus |
| GET | `/api/leaderboard` | Classement (query: limit, playerId) - JWT requis |
| POST | `/api/leaderboard` | Soumettre un score - JWT requis |
| POST | `/api/players` | Creer un joueur - JWT requis |
| GET | `/api/players/:id` | Stats joueur - JWT requis |
| GET | `/api/players/:id/upgrades` | Ameliorations - JWT requis |
| POST | `/api/players/:id/upgrades` | Acheter amelioration - JWT requis |
| GET/POST | `/api/progression/*` | Endpoints progression - JWT requis |
| GET/POST | `/api/achievements/*` | Endpoints succes - JWT requis |

Rate limit : 100 req/15min par IP. Events socket rate-limited individuellement.

## WebSocket Events

**Client -> Serveur :** `playerMove`, `shoot`, `setNickname`, `selectUpgrade`, `buyItem`, `heartbeat`

**Serveur -> Client :** `gameState` (delta-compressed), `playerDied`, `waveStart`, `bossSpawn`, `achievementUnlocked`

Session recovery : 5min apres deconnexion. Rate limiting par event par socket.

## Scripts NPM

```bash
npm start              # Production (node server.js)
npm run dev            # Dev avec nodemon (hot reload)
npm run build          # Bundle client (scripts/build-bundle.js)

npm test               # Tests Jest + coverage
npm run test:watch     # Tests en mode watch
npm run test:unit      # Tests unitaires uniquement
npm run test:integration # Tests d'integration uniquement
npm run test:e2e       # Smoke tests E2E Playwright (headless Chromium)
npm run test:e2e:ui    # E2E en mode UI interactif

npm run lint           # ESLint
npm run lint:fix       # Auto-fix lint
npm run format         # Prettier (ecriture)
npm run format:check   # Prettier (verification)
npm run fix            # lint:fix alias
npm run typecheck      # Verification TypeScript (tsconfig.check.json)

npm run db:migrate     # Executer migrations
npm run db:rollback    # Rollback migration
npm run db:status      # Statut des migrations
npm run db:backup      # Backup horodate de la base

npm run bench          # Load test (bench/loadtest.js)
npm run bench:report   # Rapport metriques (bench/metrics-report.js)

npm run health         # Verifier sante du serveur local
npm run deploy:server  # Serveur webhook CI/CD
```

## Smoke tests E2E

Fichier : `e2e/smoke-canvas.spec.js`

Vérifie au démarrage :
- `GET /` → HTTP 200 + contient `<canvas>`
- `GET /health` → HTTP 200
- `GET /openapi.yaml` → HTTP 200
- Canvas visible dans le DOM
- Screenshot sauvegardé dans `/tmp/smoke.png`
- 0 erreurs console JavaScript

```bash
# Serveur doit tourner avant de lancer les tests
npm start &
npm run test:e2e -- e2e/smoke-canvas.spec.js

# En CI (port custom)
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test e2e/smoke-canvas.spec.js
```

## Detection memory leak

```bash
# 5 bots, 5 minutes, sample toutes les 30s, seuil 50MB
node scripts/leak-test.js

# Options
node scripts/leak-test.js --bots=5 --duration=300s --sample=30s --threshold=50 --port=3001
```

Sortie : graph ASCII heap over time + `[LEAK DETECTED]` (exit 1) si delta > seuil.

## Docker

Build multi-stage `node:20-alpine` — stage builder (toutes les deps) + stage runtime (prod only). Healthcheck via `curl /health`. Utilisateur non-root `node`.

```bash
# Démarrage
docker-compose up -d

# Logs
docker-compose logs -f zombie-game

# Arrêt
docker-compose down

# Rebuild après changement de code
docker-compose up -d --build
```

La DB SQLite est persistée dans `./data/` (volume monté). Copier `.env.example` vers `.env` et ajuster les variables avant le premier lancement.

## Deploiement

```bash
docker-compose up -d        # Docker (Node 20-alpine)
pm2 start ecosystem.config.js --env production  # PM2 (port 3000)
```

Plateformes : **Fly.io** (`fly.toml`, CDG), **Railway** (`railway.json`), **Render** (`render.yaml`).
CI/CD : GitHub Actions -> ghcr.io sur push main. Voir [DOCKER.md](./DOCKER.md).

## Backup & Restore

### Backup manuel

```bash
./scripts/backup-db.sh
# Cree backups/zombie-YYYY-MM-DD_HHMM.db.gz
# Rotation automatique : 14 derniers backups conserves
```

### Restore

```bash
./scripts/restore-db.sh backups/zombie-2026-04-18_1200.db.gz
# Verifie l'integrite SQLite + checksum SHA-256 avant restore
# Sauvegarde l'ancienne DB sous data/game.db.before-restore.*
```

### Cron (backup automatique)

```bash
./scripts/install-cron.sh    # Toutes les 6h (idempotent)
./scripts/uninstall-cron.sh  # Desinstaller
```

## Configuration

```bash
cp .env.example .env
```

Variables principales :

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Port serveur |
| `NODE_ENV` | development | Environnement |
| `ALLOWED_ORIGINS` | localhost | CORS whitelist |
| `JWT_SECRET` | - | Secret JWT (obligatoire en prod) |
| `DB_PATH` | ./data/game.db | Chemin base de donnees |
| `LOG_LEVEL` | debug | error/warn/info/debug |
| `PERFORMANCE_MODE` | balanced | high/balanced/low-memory/minimal |

## Docs

Documentation racine :

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture detaillee, patterns, flux de donnees, principes SOLID
- [README.GAMEPLAY.md](./README.GAMEPLAY.md) - Gameplay complet (controles, zombies, armes, strategies)
- [DOCKER.md](./DOCKER.md) - Guide Docker et deploiement

`docs/` :

| Fichier | Description |
|---------|-------------|
| [API.md](./docs/API.md) | Reference complete de l'API REST |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architecture applicative detaillee |
| [BACKUP.md](./docs/BACKUP.md) | Procedures de backup et restauration |
| [CONFIG.md](./docs/CONFIG.md) | Variables d'environnement et configuration |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Guide de deploiement (Docker, PM2, Fly.io, Railway, Render) |
| [ITERATIONS.md](./docs/ITERATIONS.md) | Historique des iterations et evolutions |
| [PERFORMANCE.md](./docs/PERFORMANCE.md) | Profiling CPU, heap snapshot, metriques |
| [SCRIPTS.md](./docs/SCRIPTS.md) | Reference des scripts utilitaires |
| [WEBSOCKET.md](./docs/WEBSOCKET.md) | Protocole WebSocket et events Socket.IO |

`docs/adr/` — Architecture Decision Records :

- [0001-context-dependencies.md](./docs/adr/0001-context-dependencies.md)
- [0001-tcp-nodelay.md](./docs/adr/0001-tcp-nodelay.md)
- [0002-anti-cheat-disabled.md](./docs/adr/0002-anti-cheat-disabled.md)
- [0002-gitnexus-cycle-audit.md](./docs/adr/0002-gitnexus-cycle-audit.md)
- [0003-msgpack-binary-parser.md](./docs/adr/0003-msgpack-binary-parser.md)
- [0004-sqlite-wal-mode.md](./docs/adr/0004-sqlite-wal-mode.md)
- [0005-no-aoi-filtering.md](./docs/adr/0005-no-aoi-filtering.md)

## Performance profiling

### CPU profiling (V8 --prof)

Lance le serveur avec le flag `--prof`, attend N secondes, puis génère `profile.txt` :

```bash
# Durée par défaut 30s
./scripts/profile.sh

# Durée personnalisée (ex: 60s)
./scripts/profile.sh 60

# Entrée personnalisée
./scripts/profile.sh 30 deploy-server.js
```

Le fichier `profile.txt` contient le flamegraph textuel processé par `node --prof-process`.
Les fichiers `isolate-*.log` intermédiaires peuvent être supprimés après analyse.

### Heap snapshot

Envoie SIGUSR2 au processus Node pour déclencher un heap snapshot (`Heap-*.heapsnapshot`) :

```bash
# Avec PID explicite
./scripts/heap-snapshot.sh 12345

# Auto-détection du serveur en cours
./scripts/heap-snapshot.sh
```

Le fichier `.heapsnapshot` peut être ouvert dans Chrome DevTools → Memory → Load snapshot.

> Note : pour que heap-snapshot fonctionne, le serveur doit appeler `v8.writeHeapSnapshot()` sur réception de SIGUSR2 (via `process.on('SIGUSR2', ...)`).

## Mode spectateur

Un client peut se connecter en mode spectateur en passant `spectator: true` dans `socket.handshake.auth` :

```js
const socket = io(SERVER_URL, { auth: { spectator: true } });
```

Comportement côté serveur :
- Le spectateur **n'est pas créé** dans `gameState.players` → invisible des autres joueurs, non compté dans le cap `maxPlayers`.
- Il reçoit normalement les snapshots `gameState` et les deltas → peut visualiser la partie en temps réel.
- Les events `playerMove`, `playerMoveBatch` et `shoot` sont silencieusement ignorés (`return early`).
- Le flag `socket.spectator = true` est positionné à la connexion depuis `socket.handshake.auth.spectator`.

## Contributing

1. Fork + branche feature (`git checkout -b feat/my-feature`)
2. Tests obligatoires : `npm test` doit passer
3. Lint : `npm run lint:fix`
4. PR via le template `.github/PULL_REQUEST_TEMPLATE.md`

## Licence

MIT
