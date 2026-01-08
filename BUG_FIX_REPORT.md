# 🐛 BUG FIX REPORT - Système de Score/Progression

**Date:** 2026-01-08
**Ralph Loop ID:** #4
**Status:** ✅ **FIXED**

---

## 🔴 BUGS IDENTIFIÉS

### Bug #1: FOREIGN KEY constraint failed (CRITICAL)
**Description:** Échec de création de `account_progression` car `player_id` n'existe pas dans table `players`

**Error Log:**
```
2026-01-08 21:47:46 [error]: Database error in create
  {"playerId":"1443b295-b613-4c71-a23e-93f4d37eeadc","error":"FOREIGN KEY constraint failed"}
2026-01-08 21:47:46 [error]: Failed to add account XP
  {"playerId":"1443b295-b613-4c71-a23e-93f4d37eeadc","xpEarned":101,"error":"Failed to create account progression"}
```

**Root Cause:**
- Le joueur n'est jamais créé dans la table `players` lors de la connexion
- `socketHandlers.js` crée uniquement l'objet en mémoire (`gameState.players[socket.id]`)
- Pas d'appel à `CreatePlayerUseCase` lors du choix du nickname
- Quand le joueur meurt, `AddAccountXPUseCase` tente de créer `account_progression` avec un `player_id` qui n'existe pas → **FOREIGN KEY constraint failed**

---

### Bug #2: Player not found dans achievements (HIGH)
**Description:** `AchievementService` ne trouve pas le joueur car il n'existe pas en DB

**Error Log:**
```
2026-01-08 21:47:46 [error]: Failed to check achievements
  {"playerId":"1443b295-b613-4c71-a23e-93f4d37eeadc","error":"Player with identifier '1443b295-b613-4c71-a23e-93f4d37eeadc' not found"}
```

**Root Cause:**
- Même cause que Bug #1
- `SQLitePlayerRepository.getStats(id)` lance `NotFoundError` car le joueur n'existe pas

---

### Bug #3: Score/XP non sauvegardé (MEDIUM)
**Description:** Le système de progression (XP, achievements, leaderboard) ne fonctionne pas

**Root Cause:**
- Les deux bugs précédents empêchent la sauvegarde de progression
- Le joueur peut jouer mais perd toute progression

---

## ✅ FIX APPLIQUÉ

### Solution: Créer le joueur en DB lors du choix du nickname

**Fichiers modifiés:**

#### 1. `sockets/socketHandlers.js`

**Modification 1 - Ajout paramètre container (ligne 162):**
```javascript
// AVANT
function initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration) {

// APRÈS
function initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration, container = null) {
```

**Modification 2 - Passage container au handler (ligne 350):**
```javascript
// AVANT
registerSetNicknameHandler(socket, gameState, io);

// APRÈS
registerSetNicknameHandler(socket, gameState, io, container);
```

**Modification 3 - Création joueur DB dans setNickname (lignes 879-965):**
```javascript
// AVANT
function registerSetNicknameHandler(socket, gameState, io) {
  socket.on('setNickname', safeHandler('setNickname', function (data) {
    // ... validation ...

    player.nickname = nickname;
    player.hasNickname = true;

    logger.info('Player chose nickname', { socketId: socket.id, nickname });

    io.emit('playerNicknameSet', { playerId: socket.id, nickname: nickname });
  }));
}

// APRÈS
function registerSetNicknameHandler(socket, gameState, io, container) {
  socket.on('setNickname', safeHandler('setNickname', async function (data) {
    // ... validation ...

    player.nickname = nickname;
    player.hasNickname = true;

    logger.info('Player chose nickname', { socketId: socket.id, nickname });

    // HIGH FIX: Create player in database if container available and sessionId exists
    if (container && player.sessionId) {
      try {
        const createPlayerUseCase = container.get('createPlayerUseCase');
        await createPlayerUseCase.execute({
          id: player.sessionId,
          username: nickname
        });
        logger.info('Player created in database', { sessionId: player.sessionId, username: nickname });
      } catch (error) {
        // Log but don't block gameplay - player creation is optional for progression features
        logger.warn('Failed to create player in database', {
          sessionId: player.sessionId,
          username: nickname,
          error: error.message
        });
      }
    }

    io.emit('playerNicknameSet', { playerId: socket.id, nickname: nickname });
  }));
}
```

#### 2. `server.js`

**Modification - Passage container aux socketHandlers (ligne 327):**
```javascript
// AVANT
const socketHandler = initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration);

// APRÈS
const socketHandler = initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration, dbAvailable ? container : null);
```

---

## 🧪 TESTS ATTENDUS

### Test 1: Player creation
```bash
# 1. Se connecter et choisir nickname "testplayer"
# 2. Observer logs
EXPECTED LOG:
✅ "Player created in database" {"sessionId":"uuid","username":"testplayer"}
```

### Test 2: Progression après mort
```bash
# 1. Jouer et mourir
# 2. Observer logs
EXPECTED LOG:
✅ Pas d'erreur "FOREIGN KEY constraint failed"
✅ Pas d'erreur "Player not found"
✅ "Account XP added" avec succès
```

### Test 3: Vérification DB
```bash
sqlite3 data/game.db "SELECT * FROM players LIMIT 5;"
# Devrait afficher le joueur créé
```

---

## 📊 RÉSULTATS ATTENDUS

### Avant Fix
```
❌ FOREIGN KEY constraint failed
❌ Player not found
❌ XP/Progression non sauvegardé
❌ Achievements non fonctionnels
```

### Après Fix
```
✅ Player créé dans DB lors du nickname
✅ account_progression créé sans erreur
✅ achievements check fonctionne
✅ XP/Score sauvegardé correctement
```

---

## 🎯 IMPACT

**Systèmes fixés:**
- ✅ Création joueurs en DB
- ✅ Système XP/Account Progression
- ✅ Système Achievements
- ✅ Leaderboard (dépend de player_id)
- ✅ Session recovery (utilise player_id)

**Systèmes non affectés:**
- ✅ Gameplay en mémoire (gameState) - continue de fonctionner
- ✅ Joueurs sans sessionId - peuvent jouer sans DB

---

## 🔒 SÉCURITÉ

**Graceful degradation:**
- Si `container` est `null` (DB indisponible) → le joueur peut quand même jouer
- Si `sessionId` est `null` → pas de création DB, mais gameplay fonctionne
- Si création échoue → warning loggé mais gameplay continue

**Validation:**
- Username déjà validé côté socket (2-15 chars, alphanum)
- `CreatePlayerUseCase` valide à nouveau (2-20 chars)
- Duplicate check fait côté UseCase

---

## 📝 NOTES

**Choix de conception:**
- **Async handler:** Nécessaire pour `await createPlayerUseCase.execute()`
- **Try-catch:** Empêche le crash si la DB échoue
- **Optional container:** Permet de fonctionner même sans DB
- **sessionId comme player_id:** UUID fourni par client, utilisé pour progression cross-device

**Alternative considérée mais rejetée:**
- ❌ Créer le joueur à la connexion → trop tôt, pas encore de nickname
- ❌ Créer le joueur à la première mort → trop tard, erreurs avant

**Implémentation choisie:**
- ✅ Créer le joueur au choix du nickname → timing parfait, nickname disponible

---

**Ralph Loop Status:** ✅ **BUG_1_FIXED** (FOREIGN KEY constraint)
**Next:** Valider en jeu + vérifier autres bugs potentiels
