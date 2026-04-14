# Architecture — zombie-browser-game

**Index GitNexus** : 3409 symboles, 10234 relations, 286 flows d'exécution.
**Commit indexé** : `105dd42`. Re-run `gitnexus analyze` après chaque merge.

---

## Vue d'ensemble

Jeu multijoueur browser-to-server, Canvas 2D, tick 60 Hz. Un seul process Node.js héberge toute la simulation et dispatch via Socket.IO. Chaque client fait sa propre prédiction + interpolation visuelle des entités reçues du serveur.

```
┌──────────────────────────────┐         websocket           ┌────────────────────────────┐
│ CLIENT (browser)             │ ──────────────────────────▶ │ SERVER (Node.js)           │
│                              │   playerMove, shoot, buy    │                            │
│  InputManager  ◀─────────┐   │                             │  gameLoop 60Hz             │
│     │                    │   │ ◀────────────────────────── │     ├─ updatePlayers       │
│     ▼                    │   │   gameState, gameStateDelta │     ├─ zombieManager       │
│  PlayerController ──emit─┘   │                             │     ├─ collisionManager    │
│     │  (client prediction)   │                             │     ├─ bulletManager       │
│     ▼                        │                             │     └─ hazardManager       │
│  NetworkManager              │                             │                            │
│     │                        │                             │  NetworkManager            │
│     ▼                        │                             │    emitGameState (AOI)     │
│  GameStateManager            │                             │                            │
│     └─ applyInterpolation()  │                             │                            │
│         ▼                    │                             │                            │
│  Renderer / EntityRenderer   │                             │                            │
└──────────────────────────────┘                             └────────────────────────────┘
```

---

## Boot flow (critique — cassé en avril 2026)

| Étape | Code | Notes |
|---|---|---|
| 1. Page load | `index.html` charge scripts dans l'ordre | `perfPatches.js` **AVANT** `EventListenerManager.js` sinon le monkey-patch `shadowBlur` rate les premières frames |
| 2. GameEngine boot | `GameEngine.initializeManagers()` | Crée `InputManager`, `NetworkManager`, `GameStateManager`, `PlayerController`, `Renderer`. Socket `autoConnect: false`. |
| 3. Nickname screen | `#nickname-screen` visible (style="display:flex") | **Critique** : CSP doit autoriser `'unsafe-inline'` dans `style-src` sinon toutes les inline styles sont ignorées et les modals stacked deviennent visibles par défaut. Voir `middleware/security.js`. |
| 4. Clic start | `NicknameManager.startGame()` | HTTP POST `/api/auth/login` → JWT → `socket.connect()` avec auth → `playerController.setNickname()` → `gameStarted = true`. |
| 5. Game loop | `GameEngine.start()` | `requestAnimationFrame` → `update()` + `render()`. |

**Gates de gameplay** :
- `PlayerController.update()` early-return si `!gameStarted` (ligne 147).
- Les modals `level-up/shop/game-over` sont uniquement ouverts par UIManager, jamais par défaut.

---

## Input → mouvement → serveur

### Client
1. `InputManager` (capture `keydown`/`keyup` sur `window`) maintient `this.keys` + buffer `inputBuffer` (64 inputs).
2. `PlayerController.update(deltaTime)` chaque frame :
   - `input.getMovementVector()` → `{dx, dy, magnitude}` (WASD + ZQSD + flèches unifiés).
   - Angle d'aim (mouse pour desktop, direction mouvement pour mobile).
   - Collision client-side (walls sliding). Coût : 0.008 ms en moyenne.
   - `recordInput()` pour réconciliation.
   - Throttle réseau : 30 Hz en mouvement, 60 Hz sur changement direction, 20 Hz en idle.
   - `socket.emit('playerMove', {x, y, angle})` uniquement si `|Δpos| > 2px` OU `|Δangle| > 0.05 rad`.

### Serveur
`socketHandlers.js:registerPlayerMoveHandler`:
1. Validation via `validateMovementData` (bornes map).
2. Rate-limit : 100 req/s par socket (token bucket).
3. Anti-cheat : distance traveled vs timeDelta (leaky bucket). `speedMultiplier > 5` → disconnect.
4. Si validé, met à jour `gameState.players[socketId].{x,y,angle}` + `lastMoveTime`.

### Broadcast
`NetworkManager.emitGameState()` chaque tick (60 Hz) :
- Depuis PR #30 : **per-socket** avec filtrage AOI (2× viewport). Chaque joueur reçoit uniquement zombies/bullets/powerups dans sa zone. Autres joueurs + walls toujours inclus.
- Delta compression (10 frames) : full state toutes les 10 frames, delta les 9 autres.
- Graceful degradation : si `avg_latency > 500ms`, broadcastRate /= 2.

---

## Rendering (3 paliers)

`EntityRenderer.drawZombieSprite()` gate :

```
if useZombieSpriteCache            → _drawZombieSprited()    // 1 drawImage (PR #28)
else if useZombieFastDraw          → _drawZombieFast()       // 7 ops (PR #27)
else                               → full sprite              // 25+ ops, walk anim
```

Toggles auto-liés via `perfPatches.js` : `setCanvasShadowsEnabled(false)` → `useZombieFastDraw = true` → sprite cache activé par défaut.

`performanceSettings.js.autoAdjustPerformance()` déclenché à FPS < 40, cooldown 5s :

```
step 0: shadowsEnabled = false         (gain max, coût visuel ~0)
step 1: particlesEnabled = false
step 2: gridEnabled = false
step 3: resolutionScale -= 0.1 (min 0.5)
```

---

## Synchronisation état

`GameStateManager` côté client :

| Méthode | Hz | Coût moyen |
|---|---|---|
| `updateState(newState)` | 60 | < 0.1 ms (shallow assign) |
| `applyInterpolation()` | chaque render frame | 0.02 ms |
| `updateDebugStats()` | 2 Hz (throttled) | négligeable |

Interpolation :
- `baseSpeed: 25` (PR #27). Smoothing exponentiel `1 - exp(-25·dt/1000)`. Catch-up 50px en ~200ms.
- Extrapolation dead-reckoning : vélocité calculée à partir des deltas serveur, clampée à 100ms / 50px.

---

## Fichiers sensibles (≠ git)

Sur le VPS uniquement (hors repo) :
- `/var/www/zombie.morgannriu.fr/cache-bust.py` — regex idempotente, append `?v=HASH`.
- `/var/www/zombie.morgannriu.fr/deploy.sh` — `git reset` → réplique `/patches/` par-dessus → `cache-bust` → `systemctl restart zombie-game`.
- `/var/www/zombie.morgannriu.fr/patches/` — patches non-upstream (aujourd'hui vide de patches code, seul `README.md` reste).

---

## Bottlenecks historiques

| Bug | Symptôme | Root cause | PR |
|---|---|---|---|
| Modals stuck visible | Jeu ne démarre pas | CSP `style-src` sans `'unsafe-inline'` bloque `style="display:none"` HTML | #27 |
| AZERTY wheel trigger | Impossible de bouger à gauche (A) | `weaponWheel.js` écoutait `A`, conflit avec mouvement | #27 |
| Debug log spam | FPS 23, latence 4s | `D` rebound au toggle debug, keydown repeat → 200+ `console.log/s` saturait main thread | #27 + fix(debug) |
| Modal stacking | Niveau up + shop + game-over tous visibles | CSS par défaut `display:flex`, inline ignoré par CSP | #27 |
| Shop log spam | Lag à chaque achat | 13 `console.log('[Shop]...)` dans `populateShop()` | #27 (batch 2) |

---

## Processus critiques (GitNexus)

Run `gitnexus context <Symbol> --repo zombie-browser-game` pour les détails.

**Hot paths identifiés** :
- `GameEngine.update` → `PlayerController.update` → `InputManager.getMovementVector` + `checkWallCollision` + `network.playerMove`
- `GameEngine.render` → `GameStateManager.applyInterpolation` → `Renderer.render` → `EntityRenderer.renderZombies` → `drawZombieSprite`
- Socket receive : `NetworkManager.handleGameStateDelta` → `GameStateManager.updateState` → `markEntitySeen`
- Tick serveur : `gameLoop` → `updatePlayers` + `updateZombies` + `collisionManager` + `networkManager.emitGameState`

---

## Liens

- [README](../README.md) — installation, dev
- [PATCHES.md](../PATCHES.md) — patches prod (aujourd'hui vide, tout mergé)
- [CLAUDE.md](../CLAUDE.md) — guide IA avec GitNexus
- PR #27 / #28 / #29 / #30 — historique récent des fixes
