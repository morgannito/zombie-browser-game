/**
 * NETWORK MANAGER - Gestion de la compression et des deltas
 * Implémente la delta compression pour réduire la bande passante
 * Gain: -80-90% bande passante
 * @version 1.3.0 — perf/network-manager-overhaul
 */

const { SpatialGrid } = require('../../contexts/zombie/SpatialGrid');

// AOI (Area of Interest) constants — 2× viewport, centered on player
const AOI_HALF_WIDTH = 1600; // px — 2× typical viewport width / 2
const AOI_HALF_HEIGHT = 900; // px — 2× typical viewport height / 2

// Cell size for the per-tick AOI spatial grid (px)
const AOI_GRID_CELL_SIZE = 256;

// Latency threshold above which broadcast rate is halved (graceful degradation)
const HIGH_LATENCY_THRESHOLD_MS = 500;

// Per-socket throttle: above this individual latency, alternate skip/emit on
// delta ticks (≈30Hz instead of 60Hz). Keyframes always go through.
const PER_SOCKET_THROTTLE_THRESHOLD_MS = 150;

// Log sampling: emit the ">5ms" perf warning at most 1 in N ticks to avoid spam
const SLOW_EMIT_LOG_SAMPLE_RATE = 100;

// Small-room threshold: skip AOI filtering when total dynamic entities < this
const AOI_SMALL_ROOM_THRESHOLD = 5;

// Entity types subject to AOI spatial filtering
const AOI_FILTERED_TYPES = ['zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];

// --- Field-diff optimisation constants ---
// Static fields: sent only on first appearance (_new:true), never re-diffed.
const STATIC_FIELDS = new Set(['id', 'type', 'maxHealth', 'color', 'size', 'weaponType', 'name']);
// Server-internal fields: never sent to client (changing them every tick triggers
// false-positive patches without x/y, breaking client interpolation snapshots).
const SERVER_INTERNAL_FIELDS = new Set([
  'lastMoveUpdate', '_prevX', '_prevY', 'staggerOffset',
  '_stuckFrames', '_lockedTargetId', 'lastCollisionCheck',
  'lastDamageTime', 'lastAttackTime', 'spawnTime'
]);
// Dynamic fields: compared every tick. Unknown fields fall through as dynamic.
const DYNAMIC_FIELDS = ['x', 'y', 'vx', 'vy', 'angle', 'health', 'state', 'isDead'];

/** Quantise radian angle → 0-255 byte (saves ~5 bytes/entity vs float) */
function quantiseAngle(rad) {
  // Normalise to [0, 2π) then map to [0, 255]
  const norm = ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((norm / (Math.PI * 2)) * 255) & 0xff;
}

/** Dequantise 0-255 byte back to radians */
// exported so client can inline the formula — kept as documentation comment:
// angle_rad = (byte / 255) * 2π
const ANGLE_TO_RAD = (Math.PI * 2) / 255;

class NetworkManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    // Per-player previous state map (replaces single this.previousState)
    this.playerPreviousStates = new Map(); // socketId -> cloned state
    this._lastRoomIdBySocket = new Map(); // socketId -> lastRoomId (per-socket room tracking)
    // Fallback broadcast path (non-per-player delta): single reference state
    // compared against the full public snapshot. Active — used when per-player
    // AOI filtering is bypassed (see emitGameState fallback branch).
    this.previousState = {};
    this.fullStateCounter = 0;
    this._slowEmitLogCounter = 0; // for SLOW_EMIT_LOG_SAMPLE_RATE throttle
    // PERF (latency): full state every 5 frames (~83ms @ 60Hz) instead of 10.
    // Late joiners and recovering clients resync 2× faster; bandwidth bump
    // is marginal because deltas remain the dominant payload.
    this.FULL_STATE_INTERVAL = 5;

    // LATENCY OPTIMIZATION: Event batching queue
    this.eventBatchQueue = {}; // playerId -> {events: []}
    this.batchFlushTimer = null;
    this.BATCH_FLUSH_INTERVAL = 16; // 16ms (1 frame at 60 FPS)

    // LATENCY OPTIMIZATION: RTT (Round Trip Time) monitoring
    this.playerLatencies = {}; // playerId -> {latency, lastPing, samples: []}
    this.PING_INTERVAL = 2000; // Ping every 2 seconds
    this.MAX_LATENCY_SAMPLES = 10; // Keep last 10 samples for average
    this.pingIntervalTimer = null;

    // AOI PERF: per-type SpatialGrid rebuilt once per tick, shared across all sockets.
    // _aoiGridsTick tracks whether the grids match the current emitGameState() call.
    this._aoiGrids = {}; // type -> SpatialGrid instance
    for (const type of AOI_FILTERED_TYPES) {
      this._aoiGrids[type] = new SpatialGrid(AOI_GRID_CELL_SIZE);
    }
    this._aoiGridsTick = -1; // last tick the grids were built

    // AOI PERF: per-socket position cache — invalidated when player moves > threshold.
    // Stores {x, y, state} of the last filtered state for each socket.
    this._aoiPositionCache = {}; // socketId -> {x, y, state}

    // PERF: Pre-allocated delta pool — reused each tick to avoid GC pressure.
    // Entity-type sub-objects are also pre-allocated and cleared in-place.
    const _entityTypes = ['players','zombies','bullets','particles','poisonTrails','explosions','powerups','loot'];
    this._deltaPool = { updated: {}, removed: {} };
    for (const t of _entityTypes) {
      this._deltaPool.updated[t] = {};
      this._deltaPool.removed[t] = [];
    }
  }

  /**
   * PERF: Reset pooled delta object in-place (avoids new allocation each tick).
   * Clears all entity-type sub-objects without re-allocating them.
   */
  _clearDeltaPool() {
    const u = this._deltaPool.updated;
    const r = this._deltaPool.removed;
    const types = ['players','zombies','bullets','particles','poisonTrails','explosions','powerups','loot'];
    for (const t of types) {
      const uo = u[t];
      for (const k in uo) {
delete uo[k];
}
      r[t].length = 0;
    }
  }

  _sanitizePlayer(player) {
    if (!player || typeof player !== 'object') {
      return player;
    }

    const sanitized = Object.assign(Object.create(null), player);
    delete sanitized.sessionId;
    delete sanitized.socketId;
    delete sanitized.accountId;
    return sanitized;
  }

  _sanitizePlayers(players) {
    const sanitized = {};
    for (const id in players) {
      sanitized[id] = this._sanitizePlayer(players[id]);
    }
    return sanitized;
  }

  _buildPublicState() {
    return {
      players: this._sanitizePlayers(this.gameState.players),
      zombies: this.gameState.zombies,
      bullets: this.gameState.bullets,
      particles: this.gameState.particles,
      poisonTrails: this.gameState.poisonTrails,
      explosions: this.gameState.explosions,
      powerups: this.gameState.powerups,
      loot: this.gameState.loot,
      wave: this.gameState.wave,
      walls: this.gameState.walls,
      currentRoom: this.gameState.currentRoom,
      bossSpawned: this.gameState.bossSpawned
    };
  }

  /**
   * Build a public state filtered to the player's Area of Interest (AOI).
   * Entities (zombies, bullets, powerups, loot, explosions, poisonTrails, particles)
   * are filtered to those within AOI_HALF_WIDTH × AOI_HALF_HEIGHT of the player.
   * players / walls / wave / currentRoom / bossSpawned are always unfiltered.
   * Falls back to unfiltered state when player position is unknown.
   * @param {string} playerId - Socket ID of the requesting player
   * @returns {Object} Filtered public state
   */
  _buildPublicStateForPlayer(playerId, sanitizedPlayers) {
    const player = this.gameState.players[playerId];

    // Safety fallback: if position unknown, return full unfiltered state
    if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') {
      return this._buildPublicState();
    }

    // SOLO/SMALL-LOBBY FAST-PATH: AOI filtering only makes sense when there are
    // many concurrent players. With < 5 players, the bandwidth saving is dwarfed
    // by the visible freeze of zombies/bullets that briefly leave the AOI rect.
    // (Particles/bullets fluctuate wildly so we ignore them in the threshold.)
    const playerCount = Object.keys(this.gameState.players || {}).length;
    if (playerCount < 5) {
      return this._buildPublicState();
    }

    const px = player.x;
    const py = player.y;
    const minX = px - AOI_HALF_WIDTH;
    const maxX = px + AOI_HALF_WIDTH;
    const minY = py - AOI_HALF_HEIGHT;
    const maxY = py + AOI_HALF_HEIGHT;

    // Filter entity map by position
    const filterByAOI = entities => {
      const filtered = {};
      for (const id in entities) {
        const e = entities[id];
        if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
          filtered[id] = e;
        }
      }
      return filtered;
    };

    return {
      players: sanitizedPlayers || this._sanitizePlayers(this.gameState.players), // always full
      zombies: filterByAOI(this.gameState.zombies),
      bullets: filterByAOI(this.gameState.bullets),
      particles: filterByAOI(this.gameState.particles),
      poisonTrails: filterByAOI(this.gameState.poisonTrails),
      explosions: filterByAOI(this.gameState.explosions),
      powerups: filterByAOI(this.gameState.powerups),
      loot: filterByAOI(this.gameState.loot),
      wave: this.gameState.wave,
      walls: this.gameState.walls,
      currentRoom: this.gameState.currentRoom,
      bossSpawned: this.gameState.bossSpawned
    };
  }

  /**
   * Comparer deux entités de jeu (optimisé pour éviter la récursion profonde)
   * Note: Assume que les objets sont des entités de jeu avec des propriétés simples
   * @param {*} a
   * @param {*} b
   * @returns {boolean}
   */
  shallowEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }

    // Vérification rapide: compter les clés
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    // Comparer seulement les propriétés de premier niveau (les entités de jeu sont plates)
    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      const valA = a[key];
      const valB = b[key];

      // Pour les tableaux, comparer rapidement
      if (Array.isArray(valA) && Array.isArray(valB)) {
        if (valA.length !== valB.length) {
          return false;
        }
        // Pour les tableaux courts (comme piercedZombies), comparer les éléments
        if (valA.length < 10) {
          for (let j = 0; j < valA.length; j++) {
            if (valA[j] !== valB[j]) {
              return false;
            }
          }
        }
        continue;
      }

      // Pour les objets imbriqués, comparer par référence (optimisation)
      if (valA !== valB) {
        return false;
      }
    }

    return true;
  }

  /**
   * Build a field-level diff object for one entity.
   * New entities (no previous snapshot) get all fields + _new:true.
   * Existing entities get only changed dynamic fields.
   * Static fields (id, type, maxHealth, color …) are never re-sent after init.
   *
   * Quantisation applied inline:
   *   x, y        → Math.round  (integer pixels)
   *   vx, vy      → 1 decimal   (×10, integer, /10 on client)
   *   angle       → 0-255 byte  (dequant: byte/255 × 2π)
   *
   * @param {Object} cur
   * @param {Object} prev  null when entity is new
   * @returns {Object|null} diff object, or null if nothing changed
   */
  _fieldDiff(cur, prev) {
    if (!prev) {
      // New entity — send everything + flag
      const patch = Object.assign(Object.create(null), cur);
      // Quantise to 0.1px (NOT int) — int rounding causes slow entities (vx*dt < 0.5)
      // to produce identical patches → no snapshot → client interpolation freezes.
      if (typeof patch.x === 'number') {
patch.x = Math.round(patch.x * 10) / 10;
}
      if (typeof patch.y === 'number') {
patch.y = Math.round(patch.y * 10) / 10;
}
      if (typeof patch.vx === 'number') {
patch.vx = Math.round(patch.vx * 10) / 10;
}
      if (typeof patch.vy === 'number') {
patch.vy = Math.round(patch.vy * 10) / 10;
}
      if (typeof patch.angle === 'number') {
patch.angle = quantiseAngle(patch.angle);
}
      patch._new = true;
      return patch;
    }

    const patch = Object.create(null);
    let changed = false;

    for (let i = 0; i < DYNAMIC_FIELDS.length; i++) {
      const key = DYNAMIC_FIELDS[i];
      let val = cur[key];
      if (val === undefined) {
continue;
}

      // Quantise before comparison so prev (stored quantised) matches.
      // 0.1px precision (not int) preserves slow-moving entity snapshots.
      if (key === 'x' || key === 'y') {
        val = Math.round(val * 10) / 10;
      } else if (key === 'vx' || key === 'vy') {
        val = Math.round(val * 10) / 10;
      } else if (key === 'angle') {
        val = quantiseAngle(val);
      }

      const prevVal = prev[key];
      if (val !== prevVal) {
        patch[key] = val;
        changed = true;
      }
    }

    // Also diff any non-static, non-listed dynamic fields generically
    for (const key in cur) {
      if (STATIC_FIELDS.has(key)) {
continue;
}
      if (SERVER_INTERNAL_FIELDS.has(key)) {
continue;
} // never sent to client
      if (DYNAMIC_FIELDS.includes(key)) {
continue;
} // already handled
      // Skip internal stamps + private (underscored)
      if (key === '_new' || key === '_serverX' || key === '_serverY' || key === '_serverTime') {
continue;
}
      if (cur[key] !== prev[key]) {
        patch[key] = cur[key];
        changed = true;
      }
    }

    return changed ? patch : null;
  }

  /**
   * Calculer le delta entre deux états (field-diff optimisé)
   * @param {Object} current - État actuel (filtré AOI pour le socket)
   * @param {Object} previous - État précédent (filtré AOI pour le socket)
   * @param {Object} [authoritative] - État brut non filtré pour distinguer
   *   "sorti d'AOI" (à laisser orphan côté client) de "vraiment supprimé".
   * @returns {Object} Delta avec {updated, removed, meta}
   */
  calculateDelta(current, previous, authoritative = null, socketId = null) {
    // CRITICAL: Per-socket call → MUST allocate fresh delta. Reusing _deltaPool
    // here corrupts data: socket.emit() serialises asynchronously, so by the
    // time socket A's payload is encoded the pool has been cleared+refilled
    // for socket B, leaking B's state to A and freezing A's view of zombies.
    const entityTypes = [
      'players',
      'zombies',
      'bullets',
      'particles',
      'poisonTrails',
      'explosions',
      'powerups',
      'loot'
    ];
    const delta = { updated: {}, removed: {}, meta: {} };
    for (let i = 0; i < entityTypes.length; i++) {
      delta.updated[entityTypes[i]] = {};
      delta.removed[entityTypes[i]] = [];
    }

    for (let ti = 0; ti < entityTypes.length; ti++) {
      const type = entityTypes[ti];
      const currentEntities = current[type] || {};
      const previousEntities = previous[type] || {};
      const authoritativeEntities = authoritative ? authoritative[type] || {} : null;

      const updatedType = delta.updated[type];
      const removedType = delta.removed[type];

      for (const id in currentEntities) {
        const patch = this._fieldDiff(currentEntities[id], previousEntities[id] || null);
        if (patch !== null) {
          updatedType[id] = patch;
        }
      }

      for (const id in previousEntities) {
        if (!currentEntities[id]) {
          // BUGFIX (multi): only mark as removed if the entity is truly gone from
          // the authoritative game state. Entities merely outside the per-player
          // AOI are left to the client orphan cleanup (10s timeout) so they don't
          // visually pop in/out when a player crosses the AOI boundary.
          if (authoritativeEntities && authoritativeEntities[id]) {
            continue;
          }
          removedType.push(id);
        }
      }
    }

    // Meta-données (toujours envoyées)
    const lastRoomId = socketId !== null ? this._lastRoomIdBySocket.get(socketId) : undefined;
    const roomChanged = current.currentRoom !== lastRoomId;
    if (roomChanged && socketId !== null) {
      this._lastRoomIdBySocket.set(socketId, current.currentRoom);
    }
    delta.meta = {
      wave: current.wave,
      currentRoom: current.currentRoom,
      bossSpawned: current.bossSpawned,
      // walls uniquement si la room a changé (évite de renvoyer les murs statiques à chaque tick)
      ...(roomChanged ? { walls: current.walls } : {})
    };

    return delta;
  }

  /**
   * Cloner l'état actuel pour la comparaison future (optimisé)
   * OPTIMISATION: Clone manuel au lieu de JSON.parse/stringify (3-5x plus rapide)
   * BOTTLENECK OPTIMIZATION: Use Object.assign instead of spread (faster, less allocations)
   * @param {Object} state
   * @returns {Object} Clone peu profond mais suffisant pour la comparaison
   */
  cloneState(state) {
    const cloned = {
      wave: state.wave,
      currentRoom: state.currentRoom,
      bossSpawned: state.bossSpawned,
      walls: state.walls, // Les murs ne changent pas, pas besoin de cloner
      players: {},
      zombies: {},
      bullets: {},
      particles: {},
      poisonTrails: {},
      explosions: {},
      powerups: {},
      loot: {}
    };

    // Cloner chaque type d'entité avec un clone peu profond
    // Les entités de jeu ont des propriétés plates, donc un clone peu profond suffit
    const entityTypes = [
      'players',
      'zombies',
      'bullets',
      'particles',
      'poisonTrails',
      'explosions',
      'powerups',
      'loot'
    ];

    for (const type of entityTypes) {
      const entities = state[type];
      const clonedEntities = cloned[type];

      for (const id in entities) {
        const entity = entities[id];

        if (Array.isArray(entity)) {
          clonedEntities[id] = entity.slice();
        } else {
          // PERF: store only diffable fields (skip STATIC_FIELDS — never re-diffed after _new:true).
          // This reduces the clone size by ~30-40% for typical game entities.
          const snap = Object.create(null);
          for (const key in entity) {
            if (STATIC_FIELDS.has(key)) {
continue;
}
            if (SERVER_INTERNAL_FIELDS.has(key)) {
continue;
}
            if (key === '_new' || key === '_serverX' || key === '_serverY' || key === '_serverTime') {
continue;
}
            // Shallow copy; arrays (e.g. piercedZombies) are slice'd below
            snap[key] = entity[key];
          }

          // Deep-copy array fields so slice comparison stays stable
          if (entity.piercedZombies && Array.isArray(entity.piercedZombies)) {
            snap.piercedZombies = entity.piercedZombies.slice();
          }

          // Store quantised values (0.1px) so next-tick _fieldDiff compares apples to apples
          if (typeof snap.x === 'number') {
snap.x = Math.round(snap.x * 10) / 10;
}
          if (typeof snap.y === 'number') {
snap.y = Math.round(snap.y * 10) / 10;
}
          if (typeof snap.vx === 'number') {
snap.vx = Math.round(snap.vx * 10) / 10;
}
          if (typeof snap.vy === 'number') {
snap.vy = Math.round(snap.vy * 10) / 10;
}
          if (typeof snap.angle === 'number') {
snap.angle = quantiseAngle(snap.angle);
}

          clonedEntities[id] = snap;
        }
      }
    }

    return cloned;
  }

  /**
   * Compute the average latency across all tracked players.
   * Returns 0 when no data is available.
   * @returns {number} Average RTT in ms
   */
  getAverageLatency() {
    const players = Object.values(this.playerLatencies);
    if (players.length === 0) {
      return 0;
    }
    const total = players.reduce((sum, p) => sum + p.latency, 0);
    return Math.round(total / players.length);
  }

  /**
   * Determine the effective broadcast interval multiplier based on latency.
   * When average latency exceeds HIGH_LATENCY_THRESHOLD_MS the broadcast rate is
   * halved to reduce server-to-client congestion (graceful degradation).
   * @returns {number} 1 = normal, 2 = throttled (50 % FPS)
   */
  _broadcastThrottleMultiplier() {
    return this.getAverageLatency() > HIGH_LATENCY_THRESHOLD_MS ? 2 : 1;
  }

  /**
   * Per-socket adaptive throttle — skip delta tick when individual latency is
   * high (>150ms). Halves the broadcast rate for slow clients without
   * affecting LAN/fast clients in the same room. Alternates skip/emit on
   * _tickSkipCounter so each slow client still receives ~30Hz updates.
   * Full-state keyframes bypass this check in the caller.
   * @param {string} socketId
   * @returns {boolean}
   */
  _shouldSkipSocket(socketId) {
    const stats = this.playerLatencies[socketId];
    if (!stats || stats.latency <= PER_SOCKET_THROTTLE_THRESHOLD_MS) {
      return false;
    }
    const key = `_skip_${socketId}`;
    this[key] = !this[key];
    return this[key];
  }

  /**
   * Émettre l'état du jeu (full ou delta) — per-player AOI filtering
   * Each socket receives only entities within its 2× viewport Area of Interest.
   * Full state is broadcast every FULL_STATE_INTERVAL ticks; deltas otherwise.
   * Per-player previousState map ensures correct delta computation after filtering.
   * LATENCY OPTIMIZATION: Throttled to reduce network spam under high load
   * RESILIENCE: Broadcast FPS halved when average latency > 500ms
   */
  emitGameState() {
    const _t0 = performance.now();
    this.fullStateCounter++;

    // Graceful degradation: skip this tick when throttled
    const throttle = this._broadcastThrottleMultiplier();
    if (throttle > 1 && this.fullStateCounter % throttle !== 0) {
      return;
    }

    // NOTE: Global _hasGameStateChanges() removed — it compared a single
    // this.previousState against all players, causing false-negative skips
    // when one player was idle while others were still active.
    // Per-player delta detection (calculateDelta / updatedCount) in the
    // socket loop is the correct and sufficient guard.
    const isFull = this.fullStateCounter >= this.FULL_STATE_INTERVAL;

    const serverTime = Date.now();
    const sockets = this.io.sockets && this.io.sockets.sockets ? this.io.sockets.sockets : null;

    if (isFull) {
      this.fullStateCounter = 0;
    }

    if (sockets) {
      // Cache sanitized players once per tick — avoids O(n_sockets × n_players)
      // cost from calling _sanitizePlayers() inside every per-socket build.
      const sanitizedPlayers = this._sanitizePlayers(this.gameState.players);

      // PERF: When AOI is bypassed (small lobby), every socket gets the same
      // unfiltered state. Build it once and reuse — avoids N identical cloneState
      // calls and N identical _buildPublicState invocations.
      const playerCount = Object.keys(this.gameState.players || {}).length;
      const sharedState = playerCount < AOI_SMALL_ROOM_THRESHOLD
        ? this._buildPublicState()
        : null;

      // Per-player emit with AOI filtering + per-socket adaptive throttle.
      // Sockets with latency > 150ms are broadcast at half cadence (skip every
      // other non-full tick). Full-state keyframes always go through to keep
      // the client buffer in sync.
      sockets.forEach(socket => {
        const socketId = socket.id;
        if (!isFull && this._shouldSkipSocket(socketId)) {
          return;
        }
        const publicState = sharedState !== null
          ? sharedState
          : this._buildPublicStateForPlayer(socketId, sanitizedPlayers);
        const clonedState = this.cloneState(publicState);
        const prevState = this.playerPreviousStates.get(socketId) || {};

        if (isFull) {
          const fullState = {
            players: publicState.players,
            zombies: publicState.zombies,
            bullets: publicState.bullets,
            particles: publicState.particles,
            poisonTrails: publicState.poisonTrails,
            explosions: publicState.explosions,
            powerups: publicState.powerups,
            loot: publicState.loot,
            wave: publicState.wave,
            walls: publicState.walls,
            currentRoom: publicState.currentRoom,
            bossSpawned: publicState.bossSpawned,
            serverTime,
            full: true
          };
          socket.emit('gameState', fullState);
        } else {
          const delta = this.calculateDelta(publicState, prevState, this.gameState, socketId);
          delta.serverTime = serverTime;
          // PERF: count actual entity changes, not type buckets (pool always has all 8 type keys)
          let hasChanges = false;
          outerUpdated: for (const type in delta.updated) {
            for (const _ in delta.updated[type]) {
 hasChanges = true; break outerUpdated;
}
          }
          if (!hasChanges) {
            outerRemoved: for (const type in delta.removed) {
              if (delta.removed[type].length > 0) {
 hasChanges = true; break outerRemoved;
}
            }
          }
          if (hasChanges) {
            socket.emit('gameStateDelta', delta);
          }
        }

        this.playerPreviousStates.set(socketId, clonedState);
      });
    } else {
      // Fallback: no socket map available — broadcast unfiltered (safety net)
      const publicState = this._buildPublicState();
      const clonedState = this.cloneState(publicState);

      if (isFull) {
        const fullState = {
          players: publicState.players,
          zombies: publicState.zombies,
          bullets: publicState.bullets,
          particles: publicState.particles,
          poisonTrails: publicState.poisonTrails,
          explosions: publicState.explosions,
          powerups: publicState.powerups,
          loot: publicState.loot,
          wave: publicState.wave,
          walls: publicState.walls,
          currentRoom: publicState.currentRoom,
          bossSpawned: publicState.bossSpawned,
          serverTime,
          full: true
        };
        // compress:false: skip la tentative deflate (CF stripe de toute façon).
        // PAS de volatile: les deltas sont essentiels à l'interpolation des zombies côté client.
        this.io.compress(false).emit('gameState', fullState);
      } else {
        const delta = this.calculateDelta(publicState, this.previousState, this.gameState);
        delta.serverTime = serverTime;
        // PERF: for-in count instead of Object.keys() allocation (pool always has all type keys)
        let fallbackHasChanges = false;
        outerFbU: for (const type in delta.updated) {
          for (const _ in delta.updated[type]) {
 fallbackHasChanges = true; break outerFbU;
}
        }
        if (!fallbackHasChanges) {
          outerFbR: for (const type in delta.removed) {
            if (delta.removed[type].length > 0) {
 fallbackHasChanges = true; break outerFbR;
}
          }
        }
        if (fallbackHasChanges) {
          this.io.compress(false).emit('gameStateDelta', delta);
        }
      }

      this.previousState = clonedState;
    }

    const _elapsed = performance.now() - _t0;
    if (_elapsed > 5) {
      this._slowEmitLogCounter++;
      if (this._slowEmitLogCounter % SLOW_EMIT_LOG_SAMPLE_RATE === 1) {
        console.warn(
          `[NetworkManager] emitGameState took ${_elapsed.toFixed(2)}ms (>5ms threshold) [sampled 1/${SLOW_EMIT_LOG_SAMPLE_RATE}]`
        );
      }
    }
  }

  /**
   * LATENCY OPTIMIZATION: Quick check if game state has changed since last broadcast
   * FIX: Now checks actual position changes for moving entities, not just counts
   * @returns {boolean} True if changes detected
   */
  _hasGameStateChanges() {
    // Eliminate Object.keys() allocations — use for-in counting instead
    const entityTypes = [
      'players',
      'zombies',
      'bullets',
      'particles',
      'poisonTrails',
      'explosions',
      'powerups',
      'loot'
    ];
    const movingTypes = { players: true, zombies: true, bullets: true };

    for (let t = 0; t < entityTypes.length; t++) {
      const type = entityTypes[t];
      const currentEntities = this.gameState[type] || {};
      const prevEntities = this.previousState[type] || {};

      // Count without allocating arrays
      let currentCount = 0;
      let prevCount = 0;
      for (const _ in currentEntities) {
        currentCount++;
      }
      for (const _ in prevEntities) {
        prevCount++;
      }
      if (currentCount !== prevCount) {
        return true;
      }

      // Sample position check for moving entity types
      if (movingTypes[type]) {
        let checked = 0;
        for (const id in currentEntities) {
          if (checked >= 5) {
            break;
          }
          checked++;
          const current = currentEntities[id];
          const prev = prevEntities[id];
          if (!prev) {
            return true;
          }
          const dx = Math.abs((current.x || 0) - (prev.x || 0));
          const dy = Math.abs((current.y || 0) - (prev.y || 0));
          if (dx > 0.5 || dy > 0.5) {
            return true;
          }
          if (type !== 'bullets' && current.health !== prev.health) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * LATENCY OPTIMIZATION: Queue event for batching
   * Events are batched and sent once per frame (16ms) to reduce round trips
   * @param {string} playerId - Socket ID
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {boolean} immediate - If true, bypass batching and send immediately
   */
  queueEventForPlayer(playerId, event, data, immediate = false) {
    // Critical events bypass batching (death, disconnect, etc.)
    if (immediate) {
      this.io.to(playerId).emit(event, data);
      return;
    }

    // Initialize queue for player if needed
    if (!this.eventBatchQueue[playerId]) {
      this.eventBatchQueue[playerId] = { events: [] };
    }

    // Add event to queue
    this.eventBatchQueue[playerId].events.push({ event, data });

    // Start batch flush timer if not already running
    if (!this.batchFlushTimer) {
      this.batchFlushTimer = setTimeout(() => this.flushEventBatches(), this.BATCH_FLUSH_INTERVAL);
    }
  }

  /**
   * LATENCY OPTIMIZATION: Flush all batched events
   * Sends all queued events in a single 'batchedEvents' message
   */
  flushEventBatches() {
    for (const playerId in this.eventBatchQueue) {
      const batch = this.eventBatchQueue[playerId];

      if (batch.events.length > 0) {
        // Send single message with all events
        this.io.to(playerId).emit('batchedEvents', batch.events);
      }
    }

    // Clear queue and timer
    this.eventBatchQueue = {};
    this.batchFlushTimer = null;
  }

  /**
   * Émettre un événement à un joueur spécifique (legacy - immediate send)
   * @param {string} playerId - Socket ID
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données à envoyer
   */
  emitToPlayer(playerId, event, data) {
    this.io.to(playerId).emit(event, data);
  }

  /**
   * Émettre un événement à tous les joueurs
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données à envoyer
   */
  emitToAll(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Réinitialiser le système de delta
   * À appeler quand le gameState change de manière importante
   */
  resetDelta() {
    this.previousState = {};
    this.playerPreviousStates = new Map();
    this._lastRoomIdBySocket.clear();
    this.fullStateCounter = 0;
  }

  /**
   * LATENCY OPTIMIZATION: Get player latency stats
   * @param {string} playerId - Player ID
   * @returns {Object} {latency, samples, avg, min, max}
   */
  getPlayerLatency(playerId) {
    const stats = this.playerLatencies[playerId];

    if (!stats || stats.samples.length === 0) {
      return { latency: 0, samples: 0, avg: 0, min: 0, max: 0 };
    }

    const samples = stats.samples;
    const avg = stats.latency;
    const min = Math.min(...samples);
    const max = Math.max(...samples);

    return {
      latency: avg,
      samples: samples.length,
      avg,
      min,
      max
    };
  }

  /**
   * LATENCY OPTIMIZATION: Cleanup on shutdown
   */
  cleanup() {
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }

    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }

    this.eventBatchQueue = {};
    this.playerLatencies = {};
  }

  /**
   * CRITICAL FIX: Cleanup player data when they disconnect
   * Prevents memory leak from abandoned latency tracking and AOI previous states
   * @param {string} playerId - Player ID (socket ID) to cleanup
   */
  cleanupPlayer(playerId) {
    // Remove from event batch queue
    if (this.eventBatchQueue[playerId]) {
      delete this.eventBatchQueue[playerId];
      // If no more queues remain and a flush timer is pending, cancel it
      if (Object.keys(this.eventBatchQueue).length === 0 && this.batchFlushTimer) {
        clearTimeout(this.batchFlushTimer);
        this.batchFlushTimer = null;
      }
    }

    // Remove from latency tracking
    if (this.playerLatencies[playerId]) {
      delete this.playerLatencies[playerId];
    }

    // Remove per-player AOI previous state (memory cap: one entry per connected player)
    this.playerPreviousStates.delete(playerId);

    // Remove per-socket room tracking entry
    this._lastRoomIdBySocket.delete(playerId);
  }

  /**
   * Obtenir des stats réseau
   * @returns {Object}
   */
  getNetworkStats() {
    const queuedEvents = Object.values(this.eventBatchQueue).reduce(
      (total, batch) => total + batch.events.length,
      0
    );

    return {
      fullStateCounter: this.fullStateCounter,
      fullStateInterval: this.FULL_STATE_INTERVAL,
      hasPreviousState: Object.keys(this.previousState).length > 0,
      batchedEventQueue: queuedEvents,
      activePlayers: Object.keys(this.eventBatchQueue).length
    };
  }
}

module.exports = NetworkManager;
module.exports.AOI_HALF_WIDTH = AOI_HALF_WIDTH;
module.exports.AOI_HALF_HEIGHT = AOI_HALF_HEIGHT;
module.exports.ANGLE_TO_RAD = ANGLE_TO_RAD;
