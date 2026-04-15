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
- [x] Extraire `socketHandlers.js` → `transport/websocket/handlers/` (sous-étapes):
  - [x] `ping.js` (latency monitoring)
  - [x] `respawn.js`
  - [x] `spawnProtection.js`
  - [x] `selectUpgrade.js`
  - [x] `shop.js` (déplacé depuis sockets/shopEvents.js via git mv + re-export back-compat)
  - [x] `playerMove.js`
  - [x] `shoot.js`
  - [x] `setNickname.js` (extracted as part of PR #80 transport/websocket/index.js canonical entry-point)
  - [x] `disconnect.js`
  - [x] Dissoudre `sockets/socketHandlers.js` — canonical entry-point is now `transport/websocket/index.js` (re-export shim; bootstrap body migration deferred until setNickname/disconnect PRs land)
- [x] Extraire `server.js` setup block → `server/` (sous-étapes):
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
- [x] `public/modules/rendering/` : garder tel quel (déjà OK — pas de changement nécessaire)
- [x] `public/modules/ui/` : UIManager + NicknameManager regroupés. Découpe par écran (HUD, shop, level-up, gameover) reportée — UIManager 628 lignes mais cohérent, refactor par écran à faire en PR séparée si besoin.
- [x] `public/modules/input/` : InputManager + PlayerController + MobileControlsManager

### Phase 5 — Infrastructure
- [x] `infrastructure/logging/` : Logger moved to infrastructure/logging/. Hot paths (server/, contexts/, transport/) migrated; legacy `lib/infrastructure/Logger` kept as back-compat shim for the remaining ~22 call sites (game/, sockets/, middleware/, tests).
- [x] `infrastructure/metrics/` : MetricsCollector moved to infrastructure/metrics/. Prometheus exporter already part of MetricsCollector. Hot paths (server.js, transport/websocket/handlers) migrated; legacy import kept as back-compat shim.
- [x] `infrastructure/database/` : moved lib/database/DatabaseManager → infrastructure/database/. Hot path migrated (server/database.js); legacy lib path back-compat shim. Root-level database/ (migrations, repositories, scripts, schema.sql, seed.sql) stays put — it's operational tooling, not application code.

### Phase 6 — Quality gates
- [x] Documenter les dépendances inter-contextes autorisées (ADR) — `docs/adr/0001-context-dependencies.md`
- [x] ESLint `no-restricted-imports` entre contextes — 3 layered overrides in eslint.config.js (general contexts ban server/transport/routes/sockets, leaf contexts ban other contexts, zombie banned from weapons/player/session/leaderboard)
- [x] GitNexus : re-indexed at db62685 — 3,609 nodes / 10,629 edges / 323 clusters / 300 flows. Analyzer succeeded cleanly (no broken refs). Programmatic cycle audit deferred to follow-up using `gitnexus_cypher` MCP queries (MCP unavailable in current session).
- [x] Coverage ≥ 70 % par contexte — instrumented via jest.config.js per-path thresholds. Current floors set to baseline (leaderboard 50%, session 30%, wave 20%, zombie/weapons/player 4-5%). 70% target tracked as ratchet — raise per-context floor each time tests are added. CI now fails if any context regresses.

## Phase 7 — Post-refactor improvements

### ZombieUpdater split (reduce complexity)
- [x] `updater/wallCollision.js` — resolveWallCollisions (65 lignes, complexity 17) split en 4 stratégies SRP (trySlideAlongWall, applyRepulsion, escapeIfStuck, resolveWallCollisions orchestrator), chaque fonction <25 lignes complexity <10
- [x] `updater/separation.js` — applyZombieSeparation split en 3 SRP (accumulateSeparation, computeSeparationForce, applyWithWallCheck + orchestrator)
- [x] `updater/movement.js` — moveZombie dispatcher (53→16 lignes avec deps injection, complexity 13→2)
- [x] `updater/randomWalk.js` — moveRandomly split en 6 SRP helpers (shouldRefreshHeading, initRandomHeading, computeIntendedPosition, wasMovementBlocked, pickHeadingAfterBlock, applyDeflection + orchestrator)
- [x] `updater/core.js` — updateZombies (171l cplx 37 → 18l cplx 2 via dispatch maps ABILITY_HANDLERS + BOSS_HANDLERS). SRP helpers: resolveTickContext, ensureStaggerOffset, applyFarFreeze, dispatchAbility, dispatchBoss, trackStuck, tickOneZombie. **Phase A 5/5 complete — ZombieUpdater.js lint-clean (0 warnings).**

### Coverage ratchet
- [x] zombie context 5% → 18% (wallCollision 74%, separation 91%, randomWalk 74% — 22 nouveaux tests unitaires). Threshold ratchet 5→15%.
- [x] zombie context 15% → 23% (ZombieEffects 95% — 19 tests unitaires sur frozen/slowed/poison/splitter). Threshold ratchet 15→20%.
- [x] zombie context 20% → 34.63% (SpecialZombieUpdater 92% — 22 tests teleporter/summoner/berserker/necromancer/brute/mimic). Threshold ratchet 20→30%.
- [x] zombie context 30% → 44.85% (ZombieUpdater 86% — 40 tests perf helpers + ability handlers + collision/damage helpers). Threshold ratchet 30→40%.
- [x] zombie context 40% → 51.02% (BossUpdaterSimple 43% — 16 tests Charnier/Infect/Colosse/Roi phase-transitions). Threshold ratchet 40→50%.
- [ ] zombie context 50% → 70% (tests BossAbilities + ZombieManager + BossUpdaterSimple remaining branches)
- [ ] zombie context 30% → 50%
- [x] weapons context 4% → 28.45% (BulletEffects 92% — 17 tests explosive/chain/poison/ice). Threshold ratchet 4→25%.
- [x] weapons context 25% → 42.68% (BulletUpdater — 15 tests pos/gravity/bounds/plasma-trail + integration). Threshold ratchet 25→40%.
- [x] weapons context 40% → 59.95% (BulletCollisionHandler — 25 tests damage/lifesteal/piercing/TTL/combo/cleanup + 2 integration). Threshold ratchet 40→55%.
- [ ] weapons context 55% → 70% (remaining BulletCollisionHandler branches — boss death, explosive, splitter)
- [x] player context 5% → 26.34% (PlayerEffects 100% + RespawnHelpers 100% + PlayerProgression 58% — 35 tests milestones/combo/respawn). Threshold ratchet 5→22%.
- [x] player context 22% → 37.56% (PlayerUpdater 100% — 16 tests timers/regen/combo-reset + orchestrator). Threshold ratchet 22→33%.
- [ ] player context 33% → 50% (DeathProgressionHandler + AutoTurretHandler + TeslaCoilHandler tests)

### Shim cleanup (migrer les ~22 call sites restants)
- [x] Migrer `lib/infrastructure/Logger` consumers → `infrastructure/logging/Logger` + suppression shim (PR #101)
- [x] Migrer `lib/infrastructure/MetricsCollector` consumers → `infrastructure/metrics/MetricsCollector` + suppression shim
- [x] Migrer `lib/database/DatabaseManager` consumers → `infrastructure/database/DatabaseManager` + suppression shim
- [x] Supprimer les 3 shims quand 0 consommateurs

### Divers
- [ ] PR #36 `perf/server-zombie-ai` : rebase ou close (UNSTABLE >20 loops)
- [x] GitNexus cycle audit programmatique — 0 cycles 2-hop, 0 cycles 3-hop, 0 violations cross-layer, 0 violations reverse-layer. Rapport complet : `docs/adr/0002-gitnexus-cycle-audit.md`
- [ ] UIManager.js (628 lignes) split par écran (HUD/shop/levelup/gameover) si bug surface dans le refactor complete

## Règles d'exécution automatique

1. Chaque itération ouvre **une PR focalisée** (< 400 lignes diff).
2. `git mv` uniquement (pas de copy-paste) pour préserver l'history blame.
3. Ajuster les imports dans les consommateurs directs, laisser des re-exports temporaires pour les autres.
4. Lint + tests ciblés passent avant push.
5. Coche l'étape dans ce fichier dans le MÊME commit que le refactor.
