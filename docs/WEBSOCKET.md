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

| Event | Payload | Notes |
|---|---|---|
| `playerMove` | `{ x, y, angle, seq? }` | ≤ 30 Hz ; max 512 B |
| `playerMoveBatch` | `[{ dx, dy, angle, seq }, ...]` | Max 8 items ; legacy ; réponse `moveAck` |
| `shoot` | `{ angle, x?, y?, weaponId? }` | `x/y` origine optionnel (sanity cap 300px) ; max 512 B |
| `setNickname` | `{ nickname }` | Sanitisé : 2–15 chars alphanum |
| `selectUpgrade` | `{ upgradeId }` | Validé contre `pendingUpgradeChoices` (anti-cheat) |
| `buyItem` | `{ itemId, category }` | `category` : `"permanent"` ou `"temporary"` |
| `shopOpened` | — | Passe le joueur en invisible (max 60 s) |
| `shopClosed` | — | Retire l'invisibilité |
| `respawn` | — | Réinitialise le run, préserve la progression |
| `endSpawnProtection` | — | Termine la fenêtre d'invulnérabilité post-spawn |
| `app:ping` | `(timestamp, reportedLatency?, ack)` | Ack → `serverTime` ; `reportedLatency` stocké pour lag comp |
| `requestFullState` | — | Force un keyframe complet (reconnexion) |
| `adminCommand` | `{ command, args? }` | Production : désactivé sauf `ADMIN_DEBUG=true` |
| `request_leaderboard` | — | Leaderboard public |
| `submit_score` | `{ score, wave }` | Leaderboard public |

### Détails payload `playerMove`
```json
{ "x": 512, "y": 300, "angle": 1.57, "seq": 42 }
```

### Détails payload `playerMoveBatch`
```json
[
  { "dx": 5, "dy": -2, "angle": 1.57, "seq": 43 },
  { "dx": 3, "dy": -1, "angle": 1.60, "seq": 44 }
]
```
Le serveur reconstruit `x/y` à partir de la position connue + `dx/dy`. Réponse : `moveAck`.

### Détails payload `shoot`
```json
{ "angle": 0.78, "x": 514, "y": 302 }
```

---

## Événements Serveur → Client

| Event | Payload | Notes |
|---|---|---|
| `init` | Voir ci-dessous | Connexion initiale ou après `requestFullState` |
| `gameState` | Voir ci-dessous | Full keyframe toutes les ~10 ticks |
| `gameStateDelta` | Voir ci-dessous | Frames intermédiaires (diff) |
| `batchedEvents` | `[{ event, data }, ...]` | Plusieurs events groupés |
| `positionCorrection` | `{ x, y }` | Anti-cheat : téléporte le client |
| `moveAck` | `{ seq, x, y }` | Après `playerMoveBatch` |
| `stunned` | `{ duration }` | Durée restante en ms |
| `nicknameRejected` | `{ reason }` | Pseudo invalide / doublon / rate-limit |
| `playerNicknameSet` | `{ playerId, nickname }` | Broadcast `io.emit` à tous |
| `upgradeSelected` | `{ success, upgradeId }` | Confirmation upgrade appliqué |
| `shopUpdate` | `{ success, itemId?, category? }` ou `{ success, message }` | Résultat achat |
| `levelUp` | `{ level, choices[] }` | Choix d'upgrade à présenter |
| `comboUpdate` | `{ combo, multiplier }` | Mise à jour multiplicateur combo |
| `comboReset` | — | Combo interrompu |
| `accountXPGained` | `{ xp, totalXP, level }` | XP compte persistant |
| `skillBonusesLoaded` | `{ bonuses }` | Bonus de compétences chargés à la connexion |
| `achievementsUnlocked` | `[{ id, name, xpReward }]` | Succès débloqués |
| `newWave` | `{ wave, zombieCount }` | Nouvelle vague |
| `roomChanged` | `{ room }` | Changement de salle |
| `runCompleted` | `{ stats }` | Run terminé |
| `mutatorsUpdated` | `{ mutators, effects }` | Mutateurs actifs mis à jour |
| `bossSpawned` | `{ bossType, health, maxHealth }` | Boss apparu |
| `bossEnraged` | `{ bossType }` | Boss en rage |
| `bossPhaseChange` | `{ phase }` | Changement de phase boss |
| `bossClones` | `{ clones[] }` | Clones invoqués |
| `bossLaser` | `{ origin, angle, duration }` | Attaque laser |
| `bossMeteor` | `{ targets[] }` | Pluie de météores |
| `bossFireMinions` | `{ count }` | Invocation de minions feu |
| `bossIceSpikes` | `{ positions[] }` | Pics de glace |
| `bossIceClones` | `{ clones[] }` | Clones de glace |
| `bossBlizzard` | `{ duration }` | Blizzard actif |
| `bossVoidMinions` | `{ count }` | Minions du vide |
| `bossRealityWarp` | — | Distorsion de réalité |
| `bossIcePrison` | `{ targetId }` | Prison de glace |
| `bossApocalypse` | — | Phase apocalypse |
| `sessionTimeout` | — | Session expirée |
| `serverFull` | `{ message, currentPlayers }` | Serveur plein → disconnect immédiat |
| `error` | `{ message, code }` | Erreur générique |
| `adminResponse` | `{ result }` | Réponse commande admin |
| `leaderboard_update` | `{ scores[] }` | Mise à jour leaderboard |

### Détails payload `init`
```json
{
  "playerId": "socketId",
  "config": { "ROOM_WIDTH": 1600, "PLAYER_SPEED": 5 },
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

### Détails payload `gameState` (full keyframe)
```json
{
  "players": { "socketId": { "x": 512, "y": 300, "health": 100 } },
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

### Détails payload `gameStateDelta`
```json
{
  "players": { "socketId": { "x": 515, "y": 298 } },
  "zombies": [{ "id": "z1", "x": 200 }],
  "serverTime": 1713456000016,
  "full": false
}
```

### Détails payload `batchedEvents`
```json
[
  { "event": "levelUp", "data": { "level": 5, "choices": ["speed_boost", "armor"] } },
  { "event": "comboUpdate", "data": { "combo": 3, "multiplier": 1.5 } }
]
```
Dépaquetage et dispatch côté client par `NetworkManager`.

---

## Sécurité & rate limiting

| Mécanisme | Valeur |
|---|---|
| Rate limit `playerMove` | 100 req/s (token bucket) |
| Anti-cheat vitesse | `speedMultiplier > 10` → disconnect (`ENABLE_ANTICHEAT=true`) |
| Batch max | 8 entrées par `playerMoveBatch` |
| Séquence | Drop des moves out-of-order (seq check) |
| Payload max | 512 B pour `playerMove` et `shoot` |
| JWT | Vérification à chaque connexion socket (`socketMiddleware`) |
| Shop atomique | Déduction gold avec rollback si négatif (anti race-condition) |
| Upgrade anti-cheat | `selectUpgrade` validé contre `player.pendingUpgradeChoices` |

---

## Liens

- `transport/websocket/events.js` — constantes exhaustives
- `transport/websocket/index.js` — lifecycle connexion
- `transport/websocket/handlers/` — handlers par événement
- [ARCHITECTURE.md](./ARCHITECTURE.md)
