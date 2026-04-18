# WebSocket Protocol — zombie-browser-game

Transport : **Socket.IO** (engine.io sur TCP). Encodage par défaut JSON ; optionnel MessagePack (`ENABLE_MSGPACK=true`).

Constantes canoniques : `transport/websocket/events.js` — partagé client/serveur.

---

## Connexion & handshake

```
Client                              Server
  │── HTTP GET /socket.io/ ──────────▶│  engine.io upgrade → WS
  │◀─────────────────── connected ────│
  │── auth { token, sessionId? } ─────▶│  JWT middleware (socketMiddleware)
  │◀──────────── init payload ────────│  snapshot CONFIG + game state
  │◀──────────── gameState (full) ────│  premier keyframe complet
```

Nagle désactivé sur chaque socket TCP (`socket.setNoDelay(true)` dans `bootstrap.js`) → flush immédiat sans coalescing 40ms.

---

## Événements Client → Serveur

### `playerMove`
```json
{ "x": 512, "y": 300, "angle": 1.57, "seq": 42 }
```
Émis ≤ 30 Hz. Condition : `|Δpos| > 2px` OU `|Δangle| > 0.05 rad`.

### `playerMoveBatch` (legacy)
```json
[
  { "dx": 5, "dy": -2, "angle": 1.57, "seq": 43 },
  { "dx": 3, "dy": -1, "angle": 1.60, "seq": 44 }
]
```
Max 8 entrées. Le serveur reconstruit `x/y` à partir de la position connue + `dx/dy`.

### `shoot`
```json
{ "angle": 0.78, "weaponId": "shotgun" }
```

### `setNickname`
```json
{ "nickname": "Alice" }
```

### `selectUpgrade`
```json
{ "upgradeId": "speed_boost" }
```

### `buyItem`
```json
{ "itemId": "health_pack", "cost": 50 }
```

### `shopOpened` / `shopClosed`
Pas de payload.

### `respawn`
Pas de payload.

### `endSpawnProtection`
Pas de payload.

### `app:ping`
```json
{ "clientTime": 1713456000000 }
```
Namespaced pour éviter la collision avec le heartbeat engine.io interne.

### `requestFullState`
Pas de payload. Force un keyframe complet depuis le serveur.

### `adminCommand`
```json
{ "command": "spawnBoss", "args": {} }
```
Désactivé en production sauf `ADMIN_DEBUG=true`.

### `request_leaderboard` / `submit_score`
Leaderboard public. `submit_score` : `{ "score": 1500, "wave": 12 }`.

---

## Événements Serveur → Client

### `init`
Snapshot initial, émis une seule fois à la connexion (ou après `requestFullState`).
```json
{
  "playerId": "socketId",
  "config": { "ROOM_WIDTH": 1600, "PLAYER_SPEED": 5, "..." },
  "weapons": [...],
  "powerupTypes": [...],
  "zombieTypes": [...],
  "shopItems": [...],
  "walls": [...],
  "rooms": 3,
  "currentRoom": 0,
  "mutators": [],
  "mutatorEffects": null,
  "nextMutatorWave": 0,
  "recovered": false
}
```

### `gameState` (full keyframe)
Émis toutes les `FULL_STATE_INTERVAL` frames (≈ 10 ticks à 60 Hz).
```json
{
  "players": { "socketId": { "x": 512, "y": 300, "health": 100, "..." } },
  "zombies": [...],
  "bullets": [...],
  "particles": [...],
  "poisonTrails": [...],
  "explosions": [...],
  "powerups": [...],
  "loot": [...],
  "wave": 3,
  "walls": [...],
  "currentRoom": 0,
  "bossSpawned": false,
  "serverTime": 1713456000000,
  "full": true
}
```

### `gameStateDelta`
Les 9 frames intermédiaires. Ne contient que les champs modifiés depuis le dernier état.
```json
{
  "players": { "socketId": { "x": 515, "y": 298 } },
  "zombies": [{ "id": "z1", "x": 200 }],
  "serverTime": 1713456000016,
  "full": false
}
```

### `batchedEvents`
Plusieurs événements serveur groupés en un seul message pour réduire les frames WS.
```json
[
  { "event": "levelUp", "data": { "level": 5, "choices": ["..."] } },
  { "event": "comboUpdate", "data": { "combo": 3, "multiplier": 1.5 } }
]
```
Traité côté client par `NetworkManager` : dépaquetage et dispatch de chaque event individuellement.

### `positionCorrection`
```json
{ "x": 510, "y": 295 }
```
Correction anti-cheat : le client téléporte sa position locale.

### `moveAck`
```json
{ "seq": 42, "serverTime": 1713456000010 }
```

### `stunned`
```json
{ "duration": 1500 }
```

### `levelUp`
```json
{ "level": 5, "choices": ["speed_boost", "armor", "reload_speed"] }
```

### `shopUpdate`
```json
{ "items": [...], "gold": 150 }
```

### `newWave`
```json
{ "wave": 4, "zombieCount": 20 }
```

### `bossSpawned`
```json
{ "bossType": "infernal", "health": 5000, "maxHealth": 5000 }
```

### `accountXPGained`
```json
{ "xp": 250, "totalXP": 1200, "level": 7 }
```

### `achievementsUnlocked`
```json
[{ "id": "wave_10", "name": "Survivant", "xpReward": 100 }]
```

### `serverFull`
```json
{ "message": "Serveur complet. Réessayez plus tard.", "currentPlayers": 50 }
```
Suivi d'un `disconnect()` immédiat.

### `error`
```json
{ "message": "Invalid action", "code": "INVALID_INPUT" }
```

---

## Sécurité & rate limiting

| Mécanisme | Valeur |
|---|---|
| Rate limit `playerMove` | 100 req/s (token bucket) |
| Anti-cheat vitesse | `speedMultiplier > 5` → disconnect (`ENABLE_ANTICHEAT=true`) |
| Batch max | 8 entrées par `playerMoveBatch` |
| Séquence | Drop des moves out-of-order (seq check) |
| JWT | Vérification à chaque connexion socket (`socketMiddleware`) |

---

## Liens

- `transport/websocket/events.js` — constantes exhaustives
- `transport/websocket/index.js` — lifecycle connexion
- `transport/websocket/handlers/` — handlers par événement
- [ARCHITECTURE.md](./ARCHITECTURE.md)
