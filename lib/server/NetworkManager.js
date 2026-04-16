/**
 * NETWORK MANAGER - Gestion de la compression et des deltas
 * Implémente la delta compression pour réduire la bande passante
 * Gain: -80-90% bande passante
 * @version 1.1.0 — Viewport-based AOI filtering (per-player delta)
 */

const { SpatialGrid } = require('../../contexts/zombie/SpatialGrid');

// AOI (Area of Interest) constants — 2× viewport, centered on player
const AOI_HALF_WIDTH = 1600; // px — 2× typical viewport width / 2
const AOI_HALF_HEIGHT = 900; // px — 2× typical viewport height / 2

// AOI SpatialGrid cell size (px) — trade-off between bucket count and false-positive rate
const AOI_GRID_CELL = 256;
// Player must move more than this (px) before we invalidate the per-socket AOI cache
const AOI_CACHE_THRESHOLD = 50;
// Below this entity count the full linear scan is cheaper than grid overhead
const AOI_SMALL_ROOM_THRESHOLD = 5;

class NetworkManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    // Per-player previous state map (replaces single this.previousState)
    this.playerPreviousStates = {}; // socketId -> cloned state
    this._lastRoomIdBySocket = new Map(); // socketId -> lastRoomId (per-socket room tracking)
    this.previousState = {}; // kept for backward-compat / legacy callers
    this.fullStateCounter = 0;
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

    // AOI PERF: per-tick shared grids rebuilt once in emitGameState(), queried per socket
    this._aoiGrids = null; // { tick, zombies, bullets, particles, poisonTrails, explosions, powerups, loot }
    // AOI PERF: per-socket position cache — skip grid query if player hasn't moved > AOI_CACHE_THRESHOLD
    this._aoiPositionCache = {}; // socketId -> { x, y, tick, state }

    // PERF: Pre-allocated delta pool — reused every tick to avoid per-tick GC pressure.
    // calculateDelta() clears and refills this object in-place via _clearDeltaPool().
    const _entityTypesForPool = ['players','zombies','bullets','particles','poisonTrails','explosions','powerups','loot'];
    this._deltaPool = { updated: {}, removed: {}, meta: {} };
    for (const t of _entityTypesForPool) {
      this._deltaPool.updated[t] = {};
      this._deltaPool.removed[t] = [];
    }
  }

  /**
   * Reset the delta pool in-place (no allocation).
   * Called at the start of calculateDelta() to clear previous tick data.
   * @private
   */
  _clearDeltaPool() {
    const u = this._deltaPool.updated;
    const r = this._deltaPool.removed;
    const types = ['players','zombies','bullets','particles','poisonTrails','explosions','powerups','loot'];
    for (const t of types) {
      const uo = u[t];
      for (const k in uo) delete uo[k];
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
   * Count total dynamic entities across all filtered types.
   * Used for small-room fast-path: skip grid if total < AOI_SMALL_ROOM_THRESHOLD.
   * @returns {number}
   */
  _countDynamicEntities() {
    const gs = this.gameState;
    let n = 0;
    for (const _ in gs.zombies) n++;
    for (const _ in gs.bullets) n++;
    for (const _ in gs.particles) n++;
    for (const _ in gs.poisonTrails) n++;
    for (const _ in gs.explosions) n++;
    for (const _ in gs.powerups) n++;
    for (const _ in gs.loot) n++;
    return n;
  }

  /**
   * Rebuild one SpatialGrid per filtered entity type.
   * Called once per emitGameState() tick, result shared across all sockets.
   * @param {number} tick - Current tick counter (stored to detect stale grids)
   */
  _rebuildAOIGrids(tick) {
    if (this._aoiGrids && this._aoiGrids.tick === tick) {
      return; // Already built this tick
    }
    const gs = this.gameState;
    const types = ['zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];
    const grids = { tick };
    for (const type of types) {
      const grid = new SpatialGrid(AOI_GRID_CELL);
      const entities = gs[type];
      for (const id in entities) {
        const e = entities[id];
        if (typeof e.x === 'number' && typeof e.y === 'number') {
          e._id = id; // stash id for retrieval
          grid.insert(e);
        }
      }
      grids[type] = grid;
    }
    this._aoiGrids = grids;
  }

  /**
   * Build a public state filtered to the player's Area of Interest (AOI).
   *
   * Three-layer strategy:
   *   1. Small-room fast-path  — if total entities < AOI_SMALL_ROOM_THRESHOLD,
   *      run the cheap O(n) linear scan (no grid overhead).
   *   2. Position-cache hit    — if player moved < AOI_CACHE_THRESHOLD px since
   *      last computation, return the cached result (0 work).
   *   3. Grid lookup           — query per-type SpatialGrid rebuilt once per tick;
   *      O(k) where k = entities in the 3×3 neighbourhood of cells.
   *
   * players / walls / wave / currentRoom / bossSpawned are always unfiltered.
   * Falls back to unfiltered state when player position is unknown.
   *
   * @param {string} playerId        - Socket ID of the requesting player
   * @param {Object} sanitizedPlayers - Pre-sanitized players map (shared across sockets)
   * @param {number} tick             - Current tick counter
   * @returns {Object} Filtered public state
   */
  _buildPublicStateForPlayer(playerId, sanitizedPlayers, tick) {
    const player = this.gameState.players[playerId];

    // Safety fallback: if position unknown, return full unfiltered state
    if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') {
      return this._buildPublicState();
    }

    const px = player.x;
    const py = player.y;
    const players = sanitizedPlayers || this._sanitizePlayers(this.gameState.players);
    const gs = this.gameState;

    // Layer 1 — small-room fast-path: linear O(n) cheaper than grid for tiny rooms
    const total = this._countDynamicEntities();
    if (total < AOI_SMALL_ROOM_THRESHOLD) {
      const minX = px - AOI_HALF_WIDTH;
      const maxX = px + AOI_HALF_WIDTH;
      const minY = py - AOI_HALF_HEIGHT;
      const maxY = py + AOI_HALF_HEIGHT;
      const filterLinear = entities => {
        const out = {};
        for (const id in entities) {
          const e = entities[id];
          if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) out[id] = e;
        }
        return out;
      };
      return {
        players,
        zombies: filterLinear(gs.zombies),
        bullets: filterLinear(gs.bullets),
        particles: filterLinear(gs.particles),
        poisonTrails: filterLinear(gs.poisonTrails),
        explosions: filterLinear(gs.explosions),
        powerups: filterLinear(gs.powerups),
        loot: filterLinear(gs.loot),
        wave: gs.wave,
        walls: gs.walls,
        currentRoom: gs.currentRoom,
        bossSpawned: gs.bossSpawned,
      };
    }

    // Layer 2 — position-cache hit: skip recompute if player barely moved
    const cache = this._aoiPositionCache[playerId];
    if (cache && cache.tick === tick) {
      const dx = Math.abs(px - cache.x);
      const dy = Math.abs(py - cache.y);
      if (dx < AOI_CACHE_THRESHOLD && dy < AOI_CACHE_THRESHOLD) {
        // Return cached state but refresh shared mutable refs
        const s = cache.state;
        s.players = players;
        s.wave = gs.wave;
        s.walls = gs.walls;
        s.currentRoom = gs.currentRoom;
        s.bossSpawned = gs.bossSpawned;
        return s;
      }
    }

    // Layer 3 — grid lookup
    this._rebuildAOIGrids(tick);
    const grids = this._aoiGrids;
    const types = ['zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];
    const state = {
      players,
      wave: gs.wave,
      walls: gs.walls,
      currentRoom: gs.currentRoom,
      bossSpawned: gs.bossSpawned,
    };
    for (const type of types) {
      const candidates = grids[type].nearby(px, py, Math.max(AOI_HALF_WIDTH, AOI_HALF_HEIGHT));
      const out = {};
      const minX = px - AOI_HALF_WIDTH;
      const maxX = px + AOI_HALF_WIDTH;
      const minY = py - AOI_HALF_HEIGHT;
      const maxY = py + AOI_HALF_HEIGHT;
      for (let i = 0; i < candidates.length; i++) {
        const e = candidates[i];
        if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
          out[e._id] = e;
        }
      }
      state[type] = out;
    }

    // Store in cache for this tick
    this._aoiPositionCache[playerId] = { x: px, y: py, tick, state };
    return state;
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
   * Calculer le delta entre deux états
   * @param {Object} current - État actuel (filtré AOI pour le socket)
   * @param {Object} previous - État précédent (filtré AOI pour le socket)
   * @param {Object} [authoritative] - État brut non filtré pour distinguer
   *   "sorti d'AOI" (à laisser orphan côté client) de "vraiment supprimé".
   * @returns {Object} Delta avec {updated, removed, meta}
   */
  calculateDelta(current, previous, authoritative = null, socketId = null) {
    // PERF: Reuse pre-allocated pool — avoids 16+ object allocations per call
    this._clearDeltaPool();
    const delta = this._deltaPool;

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

    for (let i = 0; i < entityTypes.length; i++) {
      const type = entityTypes[i];
      const currentEntities = current[type] || {};
      const previousEntities = previous[type] || {};
      const authoritativeEntities = authoritative ? authoritative[type] || {} : null;

      const updatedType = delta.updated[type];
      const removedType = delta.removed[type];

      for (const id in currentEntities) {
        const currentEntity = currentEntities[id];
        const previousEntity = previousEntities[id];

        if (!previousEntity || !this.shallowEqual(currentEntity, previousEntity)) {
          updatedType[id] = currentEntity;
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
      // Note: pool always has all 8 type keys — no delete on empty (hasChanges uses for-in/length)
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

        // BOTTLENECK OPTIMIZATION: Object.assign ~10-15% faster than spread for shallow clone
        if (Array.isArray(entity)) {
          // Arrays: slice() faster than spread
          clonedEntities[id] = entity.slice();
        } else {
          // Objects: Object.assign with null prototype (no prototype chain lookup)
          const clonedEntity = Object.assign(Object.create(null), entity);

          // Cloner aussi les tableaux imbriqués comme piercedZombies
          if (entity.piercedZombies && Array.isArray(entity.piercedZombies)) {
            clonedEntity.piercedZombies = entity.piercedZombies.slice();
          }

          clonedEntities[id] = clonedEntity;
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
   * When average latency exceeds 500 ms the broadcast rate is halved to reduce
   * server-to-client congestion (graceful degradation).
   * @returns {number} 1 = normal, 2 = throttled (50 % FPS)
   */
  _broadcastThrottleMultiplier() {
    const HIGH_LATENCY_THRESHOLD = 500; // ms
    return this.getAverageLatency() > HIGH_LATENCY_THRESHOLD ? 2 : 1;
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

    // Monotonic tick counter for grid rebuild & cache keying — wraps safely at 2^31
    const tick = this.fullStateCounter;

    const serverTime = Date.now();
    const sockets = this.io.sockets && this.io.sockets.sockets ? this.io.sockets.sockets : null;

    if (isFull) {
      this.fullStateCounter = 0;
      // Full state tick: flush AOI position cache so every socket gets a fresh grid query
      this._aoiPositionCache = {};
    }

    if (sockets) {
      // Cache sanitized players once per tick — avoids O(n_sockets × n_players)
      // cost from calling _sanitizePlayers() inside every per-socket build.
      const sanitizedPlayers = this._sanitizePlayers(this.gameState.players);
      // Invalidate shared grid so it is rebuilt fresh for this tick
      this._aoiGrids = null;

      // Per-player emit with AOI filtering
      sockets.forEach(socket => {
        const socketId = socket.id;
        const publicState = this._buildPublicStateForPlayer(socketId, sanitizedPlayers, tick);
        const clonedState = this.cloneState(publicState);
        const prevState = this.playerPreviousStates[socketId] || {};

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
          // PERF: Pool always has all 8 type keys — check inner entries/lengths
          let hasChanges = false;
          outerUpdated: for (const type in delta.updated) { // eslint-disable-line no-labels
            for (const _ in delta.updated[type]) { hasChanges = true; break outerUpdated; } // eslint-disable-line no-labels
          }
          if (!hasChanges) {
            outerRemoved: for (const type in delta.removed) { // eslint-disable-line no-labels
              if (delta.removed[type].length > 0) { hasChanges = true; break outerRemoved; } // eslint-disable-line no-labels
            }
          }
          if (hasChanges) {
            socket.emit('gameStateDelta', delta);
          }
        }

        this.playerPreviousStates[socketId] = clonedState;
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
        // PERF: Pool always has all 8 type keys — use for-in/length instead of Object.keys
        let hasFallbackChanges = false;
        outerFbUpdated: for (const type in delta.updated) { // eslint-disable-line no-labels
          for (const _ in delta.updated[type]) { hasFallbackChanges = true; break outerFbUpdated; } // eslint-disable-line no-labels
        }
        if (!hasFallbackChanges) {
          outerFbRemoved: for (const type in delta.removed) { // eslint-disable-line no-labels
            if (delta.removed[type].length > 0) { hasFallbackChanges = true; break outerFbRemoved; } // eslint-disable-line no-labels
          }
        }
        if (hasFallbackChanges) {
          this.io.compress(false).emit('gameStateDelta', delta);
        }
      }

      this.previousState = clonedState;
    }

    const _elapsed = performance.now() - _t0;
    if (_elapsed > 5) {
      console.warn(
        `[NetworkManager] emitGameState took ${_elapsed.toFixed(2)}ms (>${5}ms threshold)`
      );
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
    this.playerPreviousStates = {};
    this._lastRoomIdBySocket.clear();
    this.fullStateCounter = 0;
    this._aoiPositionCache = {};
    this._aoiGrids = null;
  }

  /**
   * LATENCY OPTIMIZATION: Start ping/pong monitoring for all connected players.
   *
   * @deprecated RTT is now measured exclusively by the client via the app:ping
   * ack callback (transport/websocket/handlers/ping.js).  The server-push
   * approach emitted an un-namespaced 'ping' event that collided with
   * Socket.IO's internal heartbeat and was never matched by a client handler,
   * making recordPong() dead code.  This method is kept as a no-op so callers
   * don't throw; remove the call-sites when convenient.
   */
  startLatencyMonitoring() {
    // No-op: client-initiated RTT via ack is the single source of truth.
  }

  /**
   * LATENCY OPTIMIZATION: Record pong response and calculate RTT
   * @param {string} playerId - Player ID
   * @param {number} sentAt - Original ping timestamp
   */
  recordPong(playerId, sentAt) {
    const now = Date.now();
    const rtt = now - sentAt; // Round trip time in ms

    if (!this.playerLatencies[playerId]) {
      this.playerLatencies[playerId] = {
        latency: rtt,
        lastPing: sentAt,
        samples: [rtt]
      };
    } else {
      const stats = this.playerLatencies[playerId];

      // Add sample and maintain max size
      stats.samples.push(rtt);
      if (stats.samples.length > this.MAX_LATENCY_SAMPLES) {
        stats.samples.shift(); // Remove oldest sample
      }

      // Calculate average latency from samples
      const avgLatency = stats.samples.reduce((sum, val) => sum + val, 0) / stats.samples.length;
      stats.latency = Math.round(avgLatency);
    }
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
    this._aoiPositionCache = {};
    this._aoiGrids = null;
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
    if (this.playerPreviousStates[playerId]) {
      delete this.playerPreviousStates[playerId];
    }

    // Remove per-socket room tracking entry
    this._lastRoomIdBySocket.delete(playerId);

    // Remove AOI position cache entry
    delete this._aoiPositionCache[playerId];
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
module.exports.AOI_GRID_CELL = AOI_GRID_CELL;
module.exports.AOI_CACHE_THRESHOLD = AOI_CACHE_THRESHOLD;
module.exports.AOI_SMALL_ROOM_THRESHOLD = AOI_SMALL_ROOM_THRESHOLD;
