# Architecture - Zombie Multiplayer Game

Clean Architecture + DDD avec separation stricte des couches.

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────┐
│                   Presentation Layer                      │
│              server.js + routes/ + sockets/               │
│  Express HTTP, Socket.IO WebSocket, middleware            │
└──────────────────┬───────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────┐
│                  Application Layer                        │
│                 lib/application/                          │
│  Container (DI), 10 Use Cases, 2 Services                │
│  Pas de dependance framework                             │
└──────────────────┬───────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────┐
│                    Domain Layer                           │
│                   lib/domain/                             │
│  6 Entities, 4 Repository Interfaces, DomainErrors       │
│  Zero dependance externe                                 │
└──────────────────┬───────────────────────────────────────┘
                   │ implemente par
┌──────────────────▼───────────────────────────────────────┐
│                 Infrastructure Layer                      │
│                lib/infrastructure/                        │
│  6 SQLite Repositories, Logger, MetricsCollector, JWT    │
│  Validation Joi, DatabaseManager                         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   Server Layer                           │
│                   lib/server/                             │
│  Game Managers (Entity, Collision, Network, Zombie, etc.) │
│  Object Pooling, Quadtree, Performance tuning            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    Game Layer                             │
│                  game/ + game/modules/                    │
│  Game Loop, State, Modules (zombie, bullet, wave, loot)  │
└──────────────────────────────────────────────────────────┘
```

## Domain Layer (`lib/domain/`)

Coeur metier, zero dependances.

### Entities

| Entity | Fichier | Responsabilite |
|--------|---------|----------------|
| Player | `entities/Player.js` | K/D ratio, score, records, stats |
| GameSession | `entities/GameSession.js` | Lifecycle session, recovery, timeout |
| Achievement | `entities/Achievement.js` | Donnees succes |
| AccountProgression | `entities/AccountProgression.js` | XP, niveau, competences |
| LeaderboardEntry | `entities/LeaderboardEntry.js` | Score classement |
| PermanentUpgrades | `entities/PermanentUpgrades.js` | Ameliorations permanentes |

### Repository Interfaces

| Interface | Methodes |
|-----------|----------|
| IPlayerRepository | findById, findByUsername, create, update |
| ISessionRepository | save, findByPlayerId, disconnect, cleanup |
| ILeaderboardRepository | submit, getTop, findByPlayerId |
| IUpgradesRepository | get, buy, getAll |

### Errors

`DomainErrors.js` - Erreurs metier typees (PlayerNotFound, InvalidInput, etc.)

## Application Layer (`lib/application/`)

### Container (DI)

Singleton qui wire toutes les dependances au demarrage:

```javascript
const container = Container.getInstance();
container.initialize(); // Wire 6 repos + 2 services + 10 use cases
const createPlayer = container.get('createPlayer');
```

### Use Cases

| Use Case | Action |
|----------|--------|
| CreatePlayerUseCase | Creation joueur + validation |
| UpdatePlayerStatsUseCase | MAJ stats + detection records |
| SaveSessionUseCase | Persistance session |
| RecoverSessionUseCase | Reprise apres deconnexion |
| DisconnectSessionUseCase | Marquage deconnexion + fenetre recovery |
| AddAccountXPUseCase | Attribution XP compte |
| GetLeaderboardUseCase | Recuperation classement |
| SubmitScoreUseCase | Soumission score |
| BuyUpgradeUseCase | Achat amelioration permanente |
| GetUpgradesUseCase | Liste ameliorations |

### Services

| Service | Responsabilite |
|---------|----------------|
| AccountProgressionService | XP, niveaux, competences, prestige |
| AchievementService | Detection et deblocage succes |

## Infrastructure Layer (`lib/infrastructure/`)

### Repositories SQLite (6)

Chaque repo implemente une interface Domain avec prepared statements.

- SQLitePlayerRepository
- SQLiteSessionRepository
- SQLiteLeaderboardRepository
- SQLiteUpgradesRepository
- SQLiteProgressionRepository
- SQLiteAchievementRepository

### Logger (Winston)

- Production: fichiers rotatifs (5MB, 5 fichiers) `logs/error.log` + `logs/combined.log`
- Dev: console coloree
- Guard `isDebugEnabled()` pour eviter operations couteuses

### MetricsCollector

Metriques temps reel: joueurs, zombies, FPS, frame time, reseau.
Sampling fixe (60 frames) pour efficacite.

### JwtService

Generation et validation JWT. Middleware Socket.IO integre.

### DatabaseManager

- SQLite WAL mode (concurrence)
- PRAGMA optimises (10MB cache, sync NORMAL, temp memory)
- Auto-migration au demarrage
- Methodes: connect, initializeSchema, runMigrations, backup, vacuum, analyze

## Server Layer (`lib/server/`)

Managers specifiques au jeu:

| Manager | Lignes | Responsabilite |
|---------|--------|----------------|
| ConfigManager | 1027 | Config armes, zombies, powerups, shop, constantes |
| EntityManager | 730 | Object pooling (bullets, particles, loot) |
| CollisionManager | 756 | Detection collision broad-phase + narrow-phase |
| NetworkManager | 581 | Delta compression, broadcast, event batching, RTT |
| PlayerManager | 394 | Etat et gestion joueurs |
| RoomManager | 396 | Generation procedurale, portes, murs |
| ZombieManager | 783 | Spawn, difficulte progressive, types, elites |
| SkillEffectsApplicator | 281 | Application effets competences |
| RunMutatorManager | 163 | Modificateurs de run |
| PerformanceIntegration | 115 | FPS adaptatif, mode performance |
| BinaryProtocolManager | 113 | Serialisation binaire (msgpack) |
| ZombieTypes Extended | 1378 | 100+ definitions de zombies |

Utilitaires: MathUtils, ObjectPool, Quadtree, QuadtreeWorker.

## Game Layer (`game/`)

### Boucle principale (`gameLoop.js`)

1. Update zombies (mouvement, AI, effets)
2. Update bullets (physique, collision)
3. Update powerups (lifetime, collection)
4. Update loot (lifetime, collection)
5. Handle hazards
6. Emit game state (delta-compressed)

Protection: flag `gameLoopRunning`, detection stuck, error handling.

### State (`gameState.js`)

```javascript
{
  players: {},
  zombies: {},
  bullets: {},
  powerups: {},
  particles: {},
  poisonTrails: {},
  loot: {},
  explosions: {},
  walls: [],
  rooms: [],
  wave: 1,
  bossSpawned: false,
  mutatorEffects: {},
  permanentUpgrades: {},
  getNextId(counterName) // Safe ID generator avec overflow protection
}
```

### Modules (`game/modules/`)

| Module | Fichiers | Responsabilite |
|--------|----------|----------------|
| zombie/ | ZombieUpdater, BossUpdater, SpecialZombieUpdater, SpawnManager, Effects | IA, mouvement, boss, elites |
| bullet/ | BulletUpdater, CollisionHandler, BulletEffects | Physique, collision, effets speciaux |
| wave/ | WaveManager | Progression vagues, difficulte |
| loot/ | LootUpdater, PowerupUpdater | Gestion loot et powerups |
| player/ | PlayerProgression, PlayerEffects | XP, level up, effets joueur |
| hazards/ | HazardManager | Zones de danger environnementales |
| admin/ | AdminCommands | Commandes admin serveur |

## Client (`public/`)

### Architecture modulaire

81 scripts charges en ordre specifique dans `index.html`.

**Prevention memory leaks** (charges en premier):
- EventListenerManager - listeners manages avec tracking
- TimerManager - setTimeout/setInterval manages

**Core:**
- GameEngine - boucle RAF, init managers
- GameStateManager - etat global, interpolation
- InputManager - clavier/souris, polling RAF
- NetworkManager - Socket.IO, reconnexion

**Rendering:**
- Renderer (3649 lignes) - rendu complet canvas 2D
- FrustumCuller - culling entites hors camera
- CameraManager - suivi joueur, bounds

**Environnement:**
- WeatherSystem, DayNightCycle, LightingSystem, ParallaxBackground, EnvironmentalParticles

**Audio:**
- OptimizedAudioCore (Web Audio API)
- OptimizedSoundEffects, WeaponAudioSystem, AmbientAudioSystem

**Systemes de retention:**
- Achievements, DailyChallenges, Contracts, Missions
- GemSystem, UnlockSystem, SynergySystem
- MetaProgression, LifetimeStats, RetentionHooks
- Telemetry, RiskReward, RunMutators, Biomes, Skins

### Globals (`window.*`)

23 singletons exposes sur window (GameEngine, Renderer, achievementSystem, gemSystem, etc.)
Pattern: chaque systeme s'enregistre sur window au chargement.

## Principes

### SOLID

- **S** - Un use case = une operation. Un manager = une responsabilite.
- **O** - Extensible via nouveaux use cases/modules sans modifier l'existant.
- **L** - Tous les repos SQLite substituables via les interfaces Domain.
- **I** - Interfaces Repository specifiques (pas de god-interface).
- **D** - Application depend des abstractions Domain, pas des implementations SQLite.

### Patterns

| Pattern | Usage |
|---------|-------|
| Repository | Abstraction persistance (Domain interfaces -> SQLite impls) |
| Dependency Injection | Container singleton, wire au boot |
| Object Pool | EntityManager (bullets, particles, loot) |
| Delta Compression | NetworkManager (envoi uniquement des changements) |
| Observer | Events Socket.IO, systeme d'events client |
| Singleton | Container, Managers client, systemes de retention |
| Strategy | PerformanceConfig (modes high/balanced/low-memory/minimal) |
| Quadtree | Partitionnement spatial pour collisions |

## Flux de donnees

```
Client Input
    │
    ▼
Socket.IO Event (rate-limited)
    │
    ▼
socketHandlers.js (validation + sanitization)
    │
    ▼
Game Loop (gameLoop.js)
    ├── ZombieUpdater / BulletUpdater / WaveManager
    ├── CollisionManager (Quadtree)
    ├── EntityManager (Object Pool)
    └── PlayerProgression (Use Cases -> DB)
    │
    ▼
NetworkManager (delta compress)
    │
    ▼
Socket.IO Broadcast
    │
    ▼
Client GameStateManager (interpolation)
    │
    ▼
Renderer (frustum culling -> canvas 2D)
```

## Scaling

| Metrique | Valeur actuelle |
|----------|-----------------|
| Joueurs simultanes | 50+ |
| Latence API | <10ms |
| Latence WebSocket | <50ms |
| Queries DB | <1ms |
| Memoire | ~65MB RSS |
| Types de zombies | 100+ |
| Armes | 12+ |
