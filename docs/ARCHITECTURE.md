# Architecture — zombie-browser-game

**Index GitNexus** : 4461 noeuds, 12866 relations. Re-run `gitnexus analyze` après chaque merge.

---

## Layering Clean Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Presentation Layer                                       │
│  server.js · sockets/ · transport/websocket/             │
│  Express HTTP, Socket.IO, middleware                      │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  Application Layer  (lib/application/)                    │
│  Container DI · 10 Use Cases · 2 Services                 │
│  Pas de dépendance framework                              │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  Domain Layer  (lib/domain/)                              │
│  6 Entities · 4 Repository Interfaces · DomainErrors      │
│  Zéro dépendance externe                                  │
└──────────────┬───────────────────────────────────────────┘
               │ implémenté par
┌──────────────▼───────────────────────────────────────────┐
│  Infrastructure Layer  (infrastructure/ + lib/infra/)     │
│  6 SQLite Repos · Logger · MetricsCollector · JWT · Joi   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Server Game Layer  (lib/server/ + contexts/)             │
│  EntityManager · CollisionManager · NetworkManager        │
│  ZombieManager · ObjectPools · Quadtree · PerformanceConfig│
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Game Simulation Layer  (game/)                           │
│  gameLoop · gameState · roomFunctions · lootFunctions     │
│  modules: admin · hazards · wave                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Client Layer  (public/)                                  │
│  GameEngine · PlayerController · NetworkManager (client)  │
│  Renderer · EntityRenderer · performanceSettings          │
└──────────────────────────────────────────────────────────┘
```

---

## Domain Layer (`lib/domain/`)

### Entities

| Entity | Responsabilité |
|--------|----------------|
| `Player` | K/D ratio, score, records, stats |
| `GameSession` | Lifecycle session, recovery, timeout |
| `Achievement` | Données succès |
| `AccountProgression` | XP, niveau, compétences |
| `LeaderboardEntry` | Score classement |
| `PermanentUpgrades` | Améliorations permanentes |

### Repository Interfaces

| Interface | Méthodes clés |
|-----------|---------------|
| `IPlayerRepository` | findById, findByUsername, create, update |
| `ISessionRepository` | save, findByPlayerId, disconnect, cleanup |
| `ILeaderboardRepository` | submit, getTop, findByPlayerId |
| `IUpgradesRepository` | get, buy, getAll |

---

## Boot flow

| Étape | Code | Notes |
|---|---|---|
| 1. Page load | `index.html` | `perfPatches.js` **AVANT** `EventListenerManager.js` (monkey-patch `shadowBlur`) |
| 2. GameEngine boot | `GameEngine.initializeManagers()` | Socket `autoConnect: false` |
| 3. Nickname screen | `#nickname-screen` | CSP doit autoriser `'unsafe-inline'` dans `style-src` |
| 4. Clic start | `NicknameManager.startGame()` | POST `/api/auth/login` → JWT → `socket.connect()` |
| 5. Game loop | `GameEngine.start()` | `requestAnimationFrame` → `update()` + `render()` |

**Gates** : `PlayerController.update()` early-return si `!gameStarted`.

---

## Input → mouvement → serveur

### Client (30 Hz throttle)
1. `InputManager` capture `keydown/keyup` → `this.keys` + `inputBuffer[64]`
2. `PlayerController.update(dt)` : vecteur WASD+ZQSD, aim angle, collision client-side (0.008ms)
3. Emit `playerMove {x, y, angle, seq}` uniquement si `|Δpos| > 2px` OU `|Δangle| > 0.05 rad`

### Serveur
- Validation → rate-limit (100 req/s token bucket) → anti-cheat leaky-bucket (`ENABLE_ANTICHEAT=true`)
- `speedMultiplier > 10` → suspicious log ; `> 5` → disconnect

---

## Broadcast (NetworkManager serveur)

`emitGameState()` appelé via `setImmediate` après chaque tick (découplage sim/broadcast) :

- **Full state** toutes les `FULL_STATE_INTERVAL` frames (keyframe)
- **Delta** les autres frames : seuls les champs modifiés
- `compress(false)` : Cloudflare stripe de toute façon, deflate CPU inutile
- Graceful degradation : `avg_latency > 500ms` → `broadcastRate /= 2`
- Per-socket throttle : latence > 150ms → skip les non-full ticks

---

## Rendering — 3 paliers

```
useZombieSpriteCache  → _drawZombieSprited()   // 1 drawImage (PR #28)
useZombieFastDraw     → _drawZombieFast()       // 7 ops  (PR #27)
else                  → full sprite              // 25+ ops, walk anim
```

`setCanvasShadowsEnabled(false)` → active `useZombieFastDraw` + sprite cache automatiquement.

---

## Hot paths (GitNexus)

- `GameEngine.update` → `PlayerController.update` → `InputManager.getMovementVector` → `checkWallCollision` → `network.playerMove`
- `GameEngine.render` → `GameStateManager.applyInterpolation` → `Renderer.render` → `EntityRenderer.renderZombies` → `drawZombieSprite`
- Socket receive : `NetworkManager.handleGameStateDelta` → `GameStateManager.updateState` → `markEntitySeen`
- Tick serveur : `gameLoop` → `updatePlayers` + `updateZombies` + `collisionManager` + `networkManager.emitGameState`

---

## Bottlenecks résolus

| Bug | Root cause | PR |
|---|---|---|
| Modals stuck visible | CSP `style-src` sans `'unsafe-inline'` | #27 |
| AZERTY wheel trigger | `weaponWheel.js` écoutait `A` (conflit mouvement) | #27 |
| Debug log spam (FPS 23) | `D` toggle keydown repeat → 200+ `console.log/s` | #27 |
| Shop lag | 13 `console.log('[Shop]...')` dans `populateShop()` | #27 |
| Slow tick 25-26ms | broadcast synchrone dans la sim → déplacé en `setImmediate` | #31 |

---

## Liens

- [README](../README.md) · [PATCHES.md](../PATCHES.md) · [CLAUDE.md](../CLAUDE.md)
- [docs/WEBSOCKET.md](./WEBSOCKET.md) · [docs/PERFORMANCE.md](./PERFORMANCE.md)
- PRs #27 / #28 / #29 / #30 / #31
