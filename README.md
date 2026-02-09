# Zombie Multiplayer Game

Jeu de survie zombie multijoueur en temps reel, type rogue-like avec progression permanente.

**Stack:** Node.js, Express, Socket.IO, SQLite, Clean Architecture

## Quick Start

```bash
npm install
cp .env.example .env
npm start
# http://localhost:3000
```

La base de donnees et le schema sont crees automatiquement au premier lancement.

## Architecture

```
zombie-browser-game/
├── server.js                # Point d'entree Express + Socket.IO
├── config/
│   └── constants.js         # Variables d'environnement, rate limits
├── middleware/
│   ├── security.js          # Helmet, rate limiting, body parser
│   ├── cors.js              # Config CORS Socket.IO
│   └── errorHandlers.js     # 404/500, async handler, AppError
├── routes/
│   ├── auth.js              # POST /api/auth/login (JWT)
│   ├── health.js            # GET /health (metriques serveur)
│   ├── metrics.js           # GET /api/metrics (Prometheus)
│   ├── leaderboard.js       # GET/POST /api/leaderboard
│   ├── players.js           # CRUD joueurs
│   ├── progression.js       # XP, niveaux, prestige
│   └── achievements.js      # Succes
├── sockets/
│   ├── socketHandlers.js    # Events WebSocket (move, shoot, etc.)
│   └── progressionHandlers.js # XP on death, skill bonuses
├── lib/
│   ├── domain/              # Zero dependances externes
│   │   ├── entities/        # Player, GameSession, Achievement, etc.
│   │   ├── repositories/    # Interfaces (IPlayerRepository, etc.)
│   │   └── errors/          # DomainErrors
│   ├── application/         # Orchestration
│   │   ├── Container.js     # Injection de dependances (singleton)
│   │   ├── use-cases/       # 10 use cases
│   │   ├── AccountProgressionService.js
│   │   └── AchievementService.js
│   ├── infrastructure/      # Implementations techniques
│   │   ├── Logger.js        # Winston (fichiers en prod, console en dev)
│   │   ├── MetricsCollector.js
│   │   ├── auth/JwtService.js
│   │   ├── repositories/    # 6 repos SQLite
│   │   └── validation/      # Schemas Joi
│   ├── database/
│   │   └── DatabaseManager.js # Connexion, migrations, backup, WAL
│   └── server/              # Managers de jeu
│       ├── ConfigManager.js       # Armes, zombies, powerups, shop
│       ├── EntityManager.js       # Object pooling (bullets, particles)
│       ├── CollisionManager.js    # Broad-phase + narrow-phase
│       ├── NetworkManager.js      # Delta compression, batching
│       ├── PlayerManager.js       # Etat joueurs
│       ├── RoomManager.js         # Generation procedurale de salles
│       ├── ZombieManager.js       # Spawn, difficulte, elites
│       ├── RunMutatorManager.js   # Modificateurs de run
│       ├── SkillEffectsApplicator.js
│       ├── PerformanceConfig.js
│       ├── PerformanceIntegration.js
│       ├── BinaryProtocolManager.js
│       ├── ZombieTypes Extended.js # 100+ types de zombies
│       ├── MathUtils.js, ObjectPool.js, Quadtree.js
│       └── QuadtreeWorker.js
├── game/                    # Logique de jeu serveur
│   ├── gameLoop.js          # Boucle principale
│   ├── gameState.js         # Etat global (players, zombies, bullets...)
│   ├── gameConstants.js     # Constantes gameplay
│   ├── roomFunctions.js     # Gestion des salles
│   ├── playerUtils.js       # Utilitaires joueur
│   ├── lootFunctions.js     # Systeme de loot
│   ├── validationFunctions.js
│   ├── utilityFunctions.js
│   ├── particleEffects.js
│   └── modules/             # Sous-systemes modulaires
│       ├── zombie/          # ZombieUpdater, BossUpdater, SpawnManager
│       ├── bullet/          # BulletUpdater, Collision, Effects
│       ├── loot/            # LootUpdater, PowerupUpdater
│       ├── wave/            # WaveManager
│       ├── player/          # PlayerProgression, PlayerEffects
│       ├── hazards/         # HazardManager
│       └── admin/           # AdminCommands
├── public/                  # Client (73 fichiers JS, 2 CSS)
│   ├── index.html           # 81 scripts charges en ordre
│   ├── style.css            # 3585 lignes, CSS variables, responsive
│   ├── modules/             # Architecture modulaire client
│   │   ├── core/            # GameEngine, Constants, SessionManager
│   │   ├── managers/        # GameState, Input, UI, Camera, Audio, Mobile
│   │   ├── systems/         # Network, Combo, Leaderboard, Toast
│   │   ├── game/            # Renderer (3649 lignes), PlayerController
│   │   ├── environment/     # Weather, DayNight, Lighting, Parallax
│   │   ├── entities/        # DestructibleObstacles, Props
│   │   ├── audio/           # OptimizedAudioCore, SoundEffects, Ambient
│   │   ├── rendering/       # FrustumCuller
│   │   └── utils/           # initHelpers
│   ├── lib/                 # MathUtils, PerformanceUtils
│   ├── EventListenerManager.js  # Prevention memory leaks
│   ├── TimerManager.js          # Timers manages
│   ├── achievementSystem.js     # 25+ succes
│   ├── dailyChallenges.js       # Defis quotidiens
│   ├── gemSystem.js             # Monnaie premium
│   ├── contracts.js             # Contrats hebdomadaires
│   ├── missionSystem.js         # Missions long terme
│   ├── lifetimeStats.js         # Stats lifetime
│   ├── metaProgression.js       # Arbre de competences
│   ├── retentionHooks.js        # Streaks, login bonus
│   └── ...                      # +20 autres systemes
├── database/
│   ├── DatabaseManager.js   # Connexion + schema + migrations
│   ├── schema.sql           # 7 tables
│   ├── seed.sql
│   ├── repositories/        # Queries SQL
│   ├── migrations/          # 001-003
│   └── scripts/             # init-database.js
├── __tests__/               # Tests Jest
├── deploy-server.js         # Webhook GitHub CI/CD
├── downloadAssets.js        # Telechargement assets
├── setup-deploy.sh          # Setup macOS deploy
├── Dockerfile               # Node 20-alpine + better-sqlite3
├── docker-compose.yml
├── fly.toml                 # Fly.io (CDG, 256MB)
├── railway.json             # Railway
└── render.yaml              # Render
```

## API REST

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Authentification JWT |
| GET | `/health` | Health check + metriques systeme |
| GET | `/api/metrics` | Metriques Prometheus |
| GET | `/api/leaderboard` | Classement (query: limit, playerId) |
| POST | `/api/leaderboard` | Soumettre un score |
| POST | `/api/players` | Creer un joueur |
| GET | `/api/players/:id` | Stats joueur |
| GET | `/api/players/:id/upgrades` | Ameliorations |
| POST | `/api/players/:id/upgrades` | Acheter amelioration |
| GET | `/api/progression/*` | Endpoints progression |
| GET | `/api/achievements/*` | Endpoints succes |

Rate limit: 100 req/15min par IP. Events socket rate-limited individuellement.

## WebSocket Events

**Client -> Serveur:** `playerMove`, `shoot`, `setNickname`, `selectUpgrade`, `buyItem`, `heartbeat`

**Serveur -> Client:** `gameState` (delta-compressed), `playerDied`, `waveStart`, `bossSpawn`, `achievementUnlocked`

Session recovery: 5min apres deconnexion. Rate limiting par event par socket.

## Base de Donnees

SQLite avec WAL mode, prepared statements, 10MB cache.

**Tables:** `players`, `player_stats`, `player_unlocks`, `sessions`, `leaderboard`, `account_progression`, `achievements`

Migrations automatiques au demarrage. Backup/vacuum/analyze via DatabaseManager.

## Optimisations Performance

| Optimisation | Impact |
|-------------|--------|
| Object Pooling (bullets, particles) | -50-60% GC |
| Delta Compression reseau | -80-90% bande passante |
| Frustum Culling client | -60-80% entites rendues |
| Quadtree collision | O(n log n) vs O(n^2) |
| SQLite WAL + prepared statements | 100x concurrence, 10x queries |
| Adaptive FPS serveur | Scale selon charge |

## Securite

- Helmet.js (CSP, XSS, clickjacking)
- Rate limiting par IP et par event socket
- CORS configurable par environnement
- JWT authentification
- Body size limit 10KB
- Prepared statements (zero SQL injection)
- Sanitization des donnees joueur avant broadcast

## Scripts NPM

```bash
npm start              # Production
npm run dev            # Dev avec nodemon
npm test               # Tests Jest + coverage
npm run lint           # ESLint
npm run lint:fix       # Auto-fix lint
npm run format         # Prettier
npm run deploy:server  # Serveur webhook CI/CD
```

## Deploiement

### Docker

```bash
docker-compose up -d
# Health check: http://localhost:3000/health
```

Voir [DOCKER.md](./DOCKER.md) pour la configuration complete.

### Plateformes supportees

- **Docker** - Dockerfile + docker-compose inclus
- **Fly.io** - `fly.toml` (region CDG Paris)
- **Railway** - `railway.json`
- **Render** - `render.yaml`

### CI/CD

GitHub Actions build et push l'image Docker vers ghcr.io sur push main.
Webhook GitHub pour auto-deploy sur serveur dedie.

## Configuration

```bash
cp .env.example .env
```

Variables principales:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Port serveur |
| `NODE_ENV` | development | Environnement |
| `ALLOWED_ORIGINS` | localhost | CORS whitelist |
| `JWT_SECRET` | - | Secret JWT (obligatoire en prod) |
| `DB_PATH` | ./data/game.db | Chemin base de donnees |
| `LOG_LEVEL` | debug | error/warn/info/debug |
| `PERFORMANCE_MODE` | balanced | high/balanced/low-memory/minimal |

## Gameplay

Jeu de survie top-down multijoueur avec:

- 12+ armes (pistolet, shotgun, sniper, lance-roquettes, tesla, plasma...)
- 100+ types de zombies dont 5 boss et 10 elites
- Systeme de vagues avec difficulte progressive (cap wave 130)
- Generation procedurale de salles rogue-like
- Systeme de loot et powerups (15+ types)
- Arbre de competences permanent
- Systeme de prestige
- Succes, defis quotidiens, contrats hebdomadaires, missions
- Systeme de synergies armes/upgrades
- Biomes, meteo dynamique, cycle jour/nuit
- Skins et cosmetiques
- Leaderboards

Documentation complete: [README.GAMEPLAY.md](./README.GAMEPLAY.md)

## Licence

MIT
