# Zombie Multiplayer Game

Jeu de survie zombie multijoueur en temps reel, type rogue-like avec progression permanente.

**Stack:** Node.js, Express, Socket.IO, SQLite, Canvas HTML5, Clean Architecture

## Quick Start

**Prerequisites:** Node.js 18+

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
├── server.js                # Point d'entree Express + Socket.IO
├── config/                  # Variables d'environnement, rate limits
├── middleware/               # Helmet, CORS, rate limiting, error handlers
├── routes/                  # API REST (auth, health, leaderboard, players, etc.)
├── sockets/                 # Events WebSocket (move, shoot, progression)
├── lib/
│   ├── domain/              # Coeur metier - zero dependances externes
│   │   ├── entities/        # Player, GameSession, Achievement, AccountProgression
│   │   ├── repositories/    # Interfaces (IPlayerRepository, ISessionRepository, etc.)
│   │   └── errors/          # DomainErrors (PlayerNotFound, InvalidInput, etc.)
│   ├── application/         # Orchestration
│   │   ├── Container.js     # Injection de dependances (singleton)
│   │   ├── use-cases/       # 10 use cases (CreatePlayer, BuyUpgrade, SubmitScore...)
│   │   └── *Service.js      # AccountProgressionService, AchievementService
│   ├── infrastructure/      # Implementations techniques
│   │   ├── repositories/    # 6 repos SQLite (prepared statements)
│   │   ├── auth/            # JwtService
│   │   ├── validation/      # Schemas Joi
│   │   ├── Logger.js        # Winston (fichiers rotatifs en prod)
│   │   └── MetricsCollector.js
│   ├── database/
│   │   └── DatabaseManager.js # SQLite WAL, migrations, backup
│   └── server/              # Managers de jeu
│       ├── ConfigManager.js       # Config armes, zombies, powerups, shop
│       ├── EntityManager.js       # Object pooling (bullets, particles)
│       ├── CollisionManager.js    # Broad-phase + narrow-phase (Quadtree)
│       ├── NetworkManager.js      # Delta compression, batching, RTT
│       ├── PlayerManager.js       # Etat joueurs
│       ├── RoomManager.js         # Generation procedurale de salles
│       ├── ZombieManager.js       # Spawn, difficulte, elites
│       └── ...                    # RunMutator, Performance, BinaryProtocol
├── game/                    # Logique de jeu serveur
│   ├── gameLoop.js          # Boucle principale (60 FPS adaptatif)
│   ├── gameState.js         # Etat global (players, zombies, bullets, wave...)
│   ├── gameConstants.js     # Constantes gameplay
│   └── modules/             # Sous-systemes modulaires
│       ├── zombie/          # ZombieUpdater, BossUpdater, SpawnManager, Effects
│       ├── bullet/          # BulletUpdater, CollisionHandler, BulletEffects
│       ├── wave/            # WaveManager
│       ├── loot/            # LootUpdater, PowerupUpdater
│       ├── player/          # PlayerUpdater, PlayerProgression, PlayerEffects, AutoTurretHandler, TeslaCoilHandler, DeathProgressionHandler
│       ├── hazards/         # HazardManager
│       └── admin/           # AdminCommands
├── public/                  # Client (Canvas HTML5)
│   ├── index.html           # 81 scripts charges en ordre
│   ├── style.css            # CSS variables, responsive
│   ├── modules/
│   │   ├── core/            # GameEngine, Constants, SessionManager
│   │   ├── managers/        # GameState, Input, UI, Camera, Audio, Mobile
│   │   ├── systems/         # Network, Combo, Leaderboard, Toast
│   │   ├── game/            # Renderers, PlayerController
│   │   ├── rendering/       # FrustumCuller
│   │   ├── environment/     # Weather, DayNight, Lighting, Parallax
│   │   ├── entities/        # DestructibleObstacles, Props
│   │   ├── audio/           # OptimizedAudioCore, SoundEffects, Ambient
│   │   └── utils/           # initHelpers
│   └── *.js                 # Systemes standalone (achievements, gems, skins, etc.)
├── assets/                  # Assets graphiques (manifest.json)
├── database/                # Schema SQL, migrations, seed
├── __tests__/               # Tests Jest (unit: domain, application, game, lib)
├── Dockerfile               # Node 20-alpine
├── docker-compose.yml
├── fly.toml                 # Fly.io (CDG Paris)
├── railway.json             # Railway
└── render.yaml              # Render
```

## Stack technique

| Composant | Technologie |
|-----------|------------|
| Serveur | Node.js + Express |
| Temps reel | Socket.IO (WebSockets) |
| Base de donnees | SQLite (better-sqlite3, WAL mode) |
| Rendu client | Canvas HTML5 2D |
| Authentification | JWT (jsonwebtoken) |
| Validation | Joi |
| Logging | Winston |
| Serialisation | MessagePack (@msgpack/msgpack) |
| Securite | Helmet, express-rate-limit |
| Tests | Jest |
| Lint | ESLint + Prettier |
| CI/CD | GitHub Actions, Husky (pre-commit) |

## Systeme d'assets

Les assets sont declares dans `assets/manifest.json` et organises par categorie.

```
assets/
├── manifest.json            # Registre central de tous les assets
├── backgrounds/             # Fonds de biomes (PNG)
│   ├── bg_city.png
│   ├── bg_forest.png
│   ├── bg_lab.png
│   ├── bg_cemetery.png
│   └── bg_wasteland.png
├── icons/                   # Icones UI et armes (SVG, 44 fichiers)
│   ├── pistol.svg, shotgun.svg, rifle.svg, sniper.svg...
│   ├── zombie-normal.svg, zombie-fast.svg, zombie-tank.svg, zombie-boss.svg
│   └── trophy.svg, gem.svg, coin.svg, shield.svg, star.svg...
├── sprites/
│   ├── effects/             # Effets visuels (PNG)
│   │   ├── explosion_sheet.png, muzzle_flash.png
│   │   ├── blood_splatter.png, bullet_trail.png
│   │   └── poison_cloud.png, ice_effect.png, fire_effect.png
│   ├── items/               # Loot et powerups (PNG)
│   │   ├── coin_gold.png, coin_gem.png
│   │   ├── health_potion.png, ammo_crate.png
│   │   └── powerup_speed.png, powerup_damage.png, powerup_shield.png...
│   ├── players/             # Sprites joueur (PNG)
│   │   ├── player_default.png
│   │   └── player_damaged.png
│   └── zombies/             # Sprites zombies (PNG, 15 types)
│       ├── zombie_normal.png, zombie_fast.png, zombie_tank.png
│       ├── zombie_explosive.png, zombie_healer.png, zombie_poison.png
│       ├── zombie_boss.png, zombie_elite.png
│       └── ...
└── tiles/                   # Tuiles de sol et murs (PNG, 10 fichiers)
    ├── floor_concrete.png, floor_dirt.png, floor_metal.png...
    └── wall_brick.png, wall_metal.png, wall_damaged.png...
```

Le `manifest.json` mappe chaque asset a son chemin URL pour un chargement centralise par l'`AssetManager` client.

## Systeme de rendu (Client)

Le rendu est decompose en modules specialises dans `public/modules/game/` et `public/modules/rendering/`.

| Renderer | Responsabilite |
|----------|---------------|
| `Renderer.js` | Orchestrateur principal, boucle de rendu Canvas 2D |
| `EntityRenderer.js` | Rendu des joueurs, zombies, bullets, loot, powerups |
| `BackgroundRenderer.js` | Fond de biome, grille de sol, tuiles |
| `EffectsRenderer.js` | Particules, explosions, trainées, effets visuels |
| `UIRenderer.js` | HUD (vie, score, vague, arme), barres de vie, labels |
| `MinimapRenderer.js` | Mini-carte temps reel avec positions des entites |
| `FrustumCuller.js` | Culling des entites hors champ camera (-60 a -80% entites rendues) |

Modules environnementaux complementaires :

| Module | Responsabilite |
|--------|---------------|
| `WeatherSystem.js` | Pluie, neige, brouillard dynamiques |
| `DayNightCycle.js` | Cycle jour/nuit avec eclairage progressif |
| `LightingSystem.js` | Eclairage dynamique, ombres |
| `ParallaxBackground.js` | Parallaxe multi-couches pour la profondeur |
| `EnvironmentalParticles.js` | Particules ambiantes (feuilles, cendres, poussieres) |

## Systeme de vagues et boss

Le jeu utilise un systeme de salles rogue-like avec vagues progressives.

**Progression :** 3 salles par run, generation procedurale, permadeath.

- Chaque salle contient des vagues de zombies avec spawn progressif
- Un boss apparait apres les zombies reguliers de chaque salle
- La porte vers la salle suivante s'ouvre apres la mort du boss
- Difficulte progressive : plus de zombies, types varies, stats augmentees
- Cap de difficulte a la vague 130

**Types de zombies (100+) :**

| Categorie | Types |
|-----------|-------|
| Basiques | Normal, Rapide, Tank |
| Speciaux | Explosif, Soigneur, Ralentisseur, Poison, Shooter, Teleporter, Summoner, Shielded, Berserker |
| Elites | 10 variantes avec stats augmentees |
| Boss | 5 boss avec capacites uniques (charge, AOE, invocations) |

Le `WaveManager` (serveur) orchestre le spawn via le `ZombieSpawnManager`, tandis que le `BossUpdater` gere l'IA et les capacites speciales des boss.

## Systeme d'armes et upgrades

### Armes (12+)

| Arme | Degats | Cadence | Particularite |
|------|--------|---------|--------------|
| Pistolet | 40 | 180ms | Arme de base, precis |
| Shotgun | 25x5 | 600ms | 5 projectiles, dispersion |
| Mitraillette (SMG) | 30 | 80ms | Cadence elevee |
| Rifle | - | - | Polyvalent |
| Sniper | - | - | Degats eleves, cadence lente |
| Rocket Launcher | - | - | Degats AOE explosifs |
| Minigun | - | - | Cadence extreme |
| Flamethrower | - | - | Degats continus, cone |
| Laser | - | - | Tir instantane |

### Upgrades de level-up (pendant le run)

A chaque montee de niveau, choix de 1 amelioration parmi 3 :

- **Communes (60%)** : PV max, degats, vitesse, cadence, collecte, soin
- **Rares (30%)** : Regeneration, balles percantes, vol de vie, critique, esquive, epines
- **Legendaires (10%)** : Munitions explosives, tir multiple

### Upgrades permanents (shop entre les salles)

Achetes avec l'or et conserves apres la mort : vie max, degats, vitesse, cadence de tir.

### Meta-progression

- Arbre de competences permanent (`metaProgression.js`)
- Systeme de prestige (`AccountProgressionService`)
- Succes et deblocages (`achievementSystem.js`, `unlockSystem.js`)
- Synergies armes/upgrades (`synergySystem.js`)
- Defis quotidiens, contrats hebdomadaires, missions

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

## Base de donnees

SQLite avec WAL mode, prepared statements, 10MB cache.

**Tables runtime :** `players`, `sessions`, `permanent_upgrades`, `leaderboard`, `account_progression`, `skill_tree`, `achievements`, `player_achievements`

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
| MessagePack serialisation | Paquets plus compacts que JSON |

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
npm start              # Production (node server.js)
npm run dev            # Dev avec nodemon (hot reload)
npm test               # Tests Jest + coverage
npm run test:unit      # Tests unitaires uniquement
npm run lint           # ESLint
npm run lint:fix       # Auto-fix lint
npm run format         # Prettier
npm run db:migrate     # Executer migrations
npm run db:rollback    # Rollback migration
npm run db:status      # Statut des migrations
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

- **Docker** - Dockerfile (Node 20-alpine) + docker-compose inclus
- **Fly.io** - `fly.toml` (region CDG Paris, 256MB)
- **Railway** - `railway.json`
- **Render** - `render.yaml`

### CI/CD

GitHub Actions build et push l'image Docker vers ghcr.io sur push main.
Webhook GitHub pour auto-deploy sur serveur dedie.
Husky + lint-staged en pre-commit (ESLint + Prettier).

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

## Documentation complementaire

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture detaillee, patterns, flux de donnees, principes SOLID
- [README.GAMEPLAY.md](./README.GAMEPLAY.md) - Documentation gameplay complete (controles, zombies, armes, strategies)
- [DOCKER.md](./DOCKER.md) - Guide Docker et deploiement

## Licence

MIT
