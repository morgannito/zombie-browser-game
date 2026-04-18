# Performance — zombie-browser-game

Résumé des optimisations actives. Référence : PRs #27–#31, `NETWORK_OPTIMIZATIONS.md`.

---

## 1. TCP — Nagle désactivé

**Fichier** : `server/bootstrap.js`

```js
io.engine.on('connection', rawSocket => {
  rawSocket.setNoDelay(true);
});
```

`setNoDelay(true)` désactive l'algorithme de Nagle sur chaque connexion TCP. Les paquets move sont flushés immédiatement sans attendre la fenêtre de coalescing de 40ms.

**Gain** : -20 à -40ms de latence input perçue sur LAN/WiFi.

---

## 2. Encodage binaire — MessagePack (optionnel)

**Activation** : `ENABLE_MSGPACK=true` (var d'env)

- Serveur : `socket.io-msgpack-parser` passé à Socket.IO
- Client : `public/lib/msgpack-parser.js` (UMD self-contained, notepack.io inline)
- Fallback automatique : `connect_error` → reconnexion JSON

**Gain** : frames WS 40–60% plus petites.

---

## 3. Delta compression — états partiels

**Fichier** : `lib/server/NetworkManager.js`

- **Full keyframe** toutes les `FULL_STATE_INTERVAL` frames (~10 ticks)
- **Delta** les autres frames : seuls les champs modifiés (`calculateDelta`)
- `compress(false)` : évite le deflate CPU (Cloudflare compresse en edge de toute façon)

**Gain** : -70 à -80% de bytes/frame sur les ticks non-keyframe.

---

## 4. Découplage sim/broadcast — `setImmediate`

**Fichier** : `server/bootstrap.js` (`makeTickFn`)

```js
if (!overBudget && perfIntegration.shouldBroadcast()) {
  setImmediate(() => networkManager.emitGameState());
}
```

Le broadcast ne bloque plus la fin du tick serveur. `setImmediate` remet le broadcast en fin de queue event loop.

**Gain** : tick serveur mesuré réduit de 25-26ms → < 16ms ; "Slow tick detected" supprimé.

---

## 5. Broadcast partagé — O(1) au lieu de O(n sockets)

**Fichier** : `lib/server/NetworkManager.js`

Avant (PR #29) : `calculateDelta + emit` par socket → O(n_sockets × n_entities) par tick.  
Après : état partagé buildé une fois, `io.emit()` broadcast unique.

```
_buildPublicState() → cloneState → io.compress(false).emit('gameState/gameStateDelta')
```

**Gain** : CPU broadcast ~constant quelle que soit la population.

---

## 6. Object Pooling — serveur

**Fichiers** : `lib/server/entity/BulletPool.js`, `ParticlePool.js`, `EffectPool.js`

Réutilisation des objets bullets/particles/effects au lieu d'allocs GC. L'`EntityManager` gère les pools.

**Gain** : réduit GC pressure sur le hot-path serveur (60 Hz tick).

---

## 7. Rendu adaptatif — client

**Fichier** : `public/performanceSettings.js`

`autoAdjustPerformance()` déclenché après 3s consécutives sous 45 FPS, cooldown de 3s avant restauration (55+ FPS soutenu) :

| Étape | Action | Coût visuel |
|---|---|---|
| 0 | `shadowsEnabled = false` | Faible |
| 1 | `particlesEnabled = false` | Modéré |
| 2 | `gridEnabled = false` | Faible |
| 3 | `resolutionScale -= 0.1` (min 0.5) | Variable |

Restauration automatique quand FPS > 55 pendant 3s (`_highFpsStart`).

---

## 8. Sprite cache zombies — 3 paliers

**Fichier** : `public/EntityRenderer.js`

```
useZombieSpriteCache  → 1 drawImage         (PR #28, coût ~0.3ms/frame)
useZombieFastDraw     → 7 canvas ops         (PR #27, coût ~1ms/frame)
full sprite           → 25+ ops + anim       (coût ~4ms/frame @ 50 zombies)
```

`setCanvasShadowsEnabled(false)` active automatiquement les deux optimisations.

---

## 9. Throttle réseau adaptatif — client

**Fichier** : `public/modules/input/PlayerController.js`

| État | Fréquence emit |
|---|---|
| Mouvement actif | 30 Hz |
| Changement de direction | 60 Hz |
| Idle | 20 Hz |

Condition supplémentaire : ne pas émettre si `|Δpos| ≤ 2px` ET `|Δangle| ≤ 0.05 rad`.

---

## 10. Dégradation réseau

**Fichier** : `lib/server/NetworkManager.js`

- `avg_latency > 500ms` → `broadcastRate /= 2`
- Per-socket : latence > 150ms → skip les non-full ticks (client reçoit seulement les keyframes)

---

## Métriques clés (référence)

| Métrique | Cible | Outil |
|---|---|---|
| Tick serveur | < 16ms | `MetricsCollector.recordBroadcastDuration` |
| Broadcast duration | < 5ms | Warning loggé si dépassé (sampled 1/100) |
| `playerMove` rate | ≤ 100/s | `rateLimitStore.checkRateLimit` |
| Client FPS | ≥ 45 | `performanceSettings.currentFPS` |

---

## Liens

- `NETWORK_OPTIMIZATIONS.md` — détails MessagePack
- `lib/server/NetworkManager.js` — émission + delta
- `public/performanceSettings.js` — adaptive quality
- `server/bootstrap.js` — TCP nodelay + setImmediate
- [ARCHITECTURE.md](./ARCHITECTURE.md)
