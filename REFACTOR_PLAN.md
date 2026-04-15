# Refactor Roadmap — zombie-browser-game

Cible : **hexagonal / clean architecture** avec découpage par bounded context (DDD-léger). Backend Node/Socket.IO + frontend Canvas2D, tous deux dans le même repo.

## État actuel (snapshot)

```
.
├── server.js                # god-file : bootstrap + loops + timers
├── game/                    # logique gameplay + boucle ticks
│   ├── gameLoop.js
│   ├── lootFunctions.js
│   └── modules/
│       ├── bullet/          # collisions, effets, update
│       ├── zombie/          # AI, spawn, boss
│       ├── player/          # progression, respawn, updater
│       ├── wave/            # WaveManager
│       └── admin/           # debug
├── lib/
│   ├── application/         # use cases (bon ✓)
│   ├── domain/              # entités DDD (bon ✓)
│   ├── infrastructure/      # DB, logger, metrics
│   └── server/              # RoomManager, CollisionManager, NetworkManager,
│                              ZombieManager, PerformanceConfig, SpatialGrid,
│                              PlayerManager, EntityManager, config/
├── sockets/                 # socketHandlers, shopEvents, rateLimitStore,
│                              sessionRecovery, playerStateFactory
├── shared/                  # socketEvents.js (events constants)
├── routes/                  # Express routes (auth, players, leaderboard)
├── middleware/              # auth, rateLimit, security
├── database/                # migrations + repositories
├── config/                  # constants
├── public/                  # client browser
│   ├── index.html
│   ├── audioSystem.js
│   ├── performanceSettings.js
│   ├── perfPatches.js
│   ├── weaponWheel.js
│   ├── achievementSystem.js
│   ├── dailyChallenges.js
│   ├── lifetimeStats.js
│   ├── leaderboardSystem.js
│   └── modules/
│       ├── managers/        # GameStateManager, UIManager, InputManager,
│                              NetworkManager, MobileControlsManager,
│                              CameraManager, AssetManager, SessionManager
│       ├── systems/         # LeaderboardSystem, AccountProgressionManager, ...
│       ├── rendering/       # Renderer, EntityRenderer, BackgroundRenderer
│       └── game/            # PlayerController
└── e2e/                     # Playwright
```

## Cible

```
src/                         # (renommage symbolique — ou on reste racine + contexts/)
├── server/                  # bootstrap + process lifecycle uniquement
│   └── index.js             # ex server.js amaigri
├── contexts/
│   ├── gameloop/            # boucle de tick + orchestration
│   ├── player/              # entité + use cases + handlers socket
│   ├── zombie/              # AI, spawn, boss, pathfinding
│   ├── weapons/             # bullets, effets, damage
│   ├── wave/                # progression, shop, level-up
│   ├── session/             # auth, recovery, nickname
│   └── leaderboard/         # score, daily, achievements
├── transport/
│   ├── http/                # routes Express
│   ├── websocket/           # socketHandlers découpé par context
│   └── events.js            # shared/socketEvents.js
├── infrastructure/          # DB, logger, metrics, rate-limit
├── shared/                  # DTOs, utils, constants
└── client/                  # frontend (ex public/)
    ├── rendering/
    ├── input/
    ├── network/
    ├── state/
    └── ui/
```

## Principes

- **Un contexte = un répertoire**, code métier pur à l'intérieur. Pas d'import cross-context → passer par events ou use cases explicites.
- **Transport ≠ domaine** : les handlers socket restent dans `transport/websocket/` et délèguent aux use cases du contexte.
- **Server.js < 100 lignes** : bootstrap + wiring, c'est tout.
- **Pas de god-file** : `socketHandlers.js` (~900 lignes) découpé par contexte.
- **Tests au niveau du contexte** : `__tests__/contexts/<name>/`.
- **Dépendances explicites via Container** (déjà en place dans `lib/application/Container.js` → étendre).
- **Client mirror le découpage** : `client/network/NetworkManager.js` ↔ `transport/websocket/`.

## Étapes (cochées au fur et à mesure par le cron)

### Phase 1 — Inventaire & quick wins (safe)
- [x] Créer REFACTOR_PLAN.md (cette PR)
- [ ] Extraire `socketHandlers.js` → `transport/websocket/handlers/` (sous-étapes):
  - [x] `ping.js` (latency monitoring)
  - [x] `respawn.js`
  - [x] `spawnProtection.js`
  - [x] `selectUpgrade.js`
  - [x] `shop.js` (déplacé depuis sockets/shopEvents.js via git mv + re-export back-compat)
  - [x] `playerMove.js`
  - [x] `shoot.js`
  - [ ] `setNickname.js`
  - [x] `disconnect.js`
  - [x] Dissoudre `sockets/socketHandlers.js` — canonical entry-point is now `transport/websocket/index.js` (re-export shim; bootstrap body migration deferred until setNickname/disconnect PRs land)
- [ ] Extraire `server.js` setup block → `server/` (sous-étapes):
  - [x] `server/socketio.js` — Socket.IO factory
  - [x] `server/memory.js` — MemoryMonitor init
  - [x] `server/database.js` — dbManager init
  - [x] `server/middleware.js` — express middleware wiring
  - [x] `server/routes.js` — route mounting
  - [x] `server/bootstrap.js` — main startServer orchestrator (sous-étapes):
    - [x] `server/gameManagers.js` — entity/collision/network/room/zombie/mutator init
    - [x] `server/heartbeat.js` — inactivity cleanup interval
    - [x] `server/bootstrap.js` — final startServer orchestrator
- [x] Extraire `server.js` timer block (gameLoop + heartbeat + powerup spawner) → `server/timers.js` (heartbeat → server/heartbeat.js, powerup spawner → server/bootstrap.js, gameLoop → server/timers.js)
- [x] Extraire `server.js` shutdown → `server/cleanup.js`

### Phase 2 — Contextes domaine
- [x] Créer `contexts/zombie/` : déplacer `game/modules/zombie/*` + `lib/server/ZombieManager.js` + `lib/server/SpatialGrid.js`
- [x] Créer `contexts/weapons/` : déplacer `game/modules/bullet/*` + `lib/server/CollisionManager.js`
- [x] Créer `contexts/player/` : déplacer `game/modules/player/*` + `lib/server/PlayerManager.js`
- [x] Créer `contexts/wave/` : déplacer `game/modules/wave/*` + `lib/server/RoomManager.js`
- [x] Créer `contexts/session/` : déplacer `sockets/sessionRecovery.js` + `sockets/playerStateFactory.js`
- [x] Créer `contexts/leaderboard/` : déplacer SubmitScoreUseCase + GetLeaderboardUseCase (server). `public/leaderboardSystem.js` (client) reporté en Phase 4 (client mirror).

### Phase 3 — Transport
- [x] `transport/http/` : routes Express regroupées
- [x] `transport/websocket/index.js` : setup io + registry des handlers par contexte
- [x] `transport/websocket/events.js` : move shared/socketEvents.js ici

### Phase 4 — Client mirror
- [x] `public/modules/network/` : network singleton (NetworkManager moved from modules/systems/). Delta handler split deferred to subsequent iteration if needed.
- [x] `public/modules/state/` : GameStateManager + ZombieInterpolator
- [ ] `public/modules/rendering/` : garder tel quel (déjà OK)
- [x] `public/modules/ui/` : UIManager + NicknameManager regroupés. Découpe par écran (HUD, shop, level-up, gameover) reportée — UIManager 628 lignes mais cohérent, refactor par écran à faire en PR séparée si besoin.
- [x] `public/modules/input/` : InputManager + PlayerController + MobileControlsManager

### Phase 5 — Infrastructure
- [ ] `infrastructure/logging/` : wrappers Logger
- [ ] `infrastructure/metrics/` : MetricsCollector + Prometheus exporter
- [ ] `infrastructure/database/` : fusion `database/` + `lib/database/` + `lib/infrastructure/DatabaseManager.js`

### Phase 6 — Quality gates
- [ ] Documenter les dépendances inter-contextes autorisées (ADR)
- [ ] ESLint `no-restricted-imports` entre contextes
- [ ] GitNexus : re-indexer et vérifier 0 cycle
- [ ] Coverage ≥ 70 % par contexte

## Règles d'exécution automatique

1. Chaque itération ouvre **une PR focalisée** (< 400 lignes diff).
2. `git mv` uniquement (pas de copy-paste) pour préserver l'history blame.
3. Ajuster les imports dans les consommateurs directs, laisser des re-exports temporaires pour les autres.
4. Lint + tests ciblés passent avant push.
5. Coche l'étape dans ce fichier dans le MÊME commit que le refactor.
