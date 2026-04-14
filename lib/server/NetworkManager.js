/**
 * NETWORK MANAGER - Gestion de la compression et des deltas
 * Implémente la delta compression pour réduire la bande passante
 * Gain: -80-90% bande passante
 * @version 1.1.0 — Viewport-based AOI filtering (per-player delta)
 */

// AOI (Area of Interest) constants — 2× viewport, centered on player
const AOI_HALF_WIDTH = 1600; // px — 2× typical viewport width / 2
const AOI_HALF_HEIGHT = 900; // px — 2× typical viewport height / 2

class NetworkManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    // Per-player previous state map (replaces single this.previousState)
    this.playerPreviousStates = {}; // socketId -> cloned state
    this.previousState = {}; // kept for backward-compat / legacy callers
    this.fullStateCounter = 0;
    this.FULL_STATE_INTERVAL = 10; // Envoyer l'état complet toutes les 10 frames (~166ms)

    // LATENCY OPTIMIZATION: Event batching queue
    this.eventBatchQueue = {}; // playerId -> {events: []}
    this.batchFlushTimer = null;
    this.BATCH_FLUSH_INTERVAL = 16; // 16ms (1 frame at 60 FPS)

    // LATENCY OPTIMIZATION: RTT (Round Trip Time) monitoring
    this.playerLatencies = {}; // playerId -> {latency, lastPing, samples: []}
    this.PING_INTERVAL = 2000; // Ping every 2 seconds
    this.MAX_LATENCY_SAMPLES = 10; // Keep last 10 samples for average
    this.pingIntervalTimer = null;
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
  _buildPublicStateForPlayer(playerId) {
    const player = this.gameState.players[playerId];

    // Safety fallback: if position unknown, return full unfiltered state
    if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') {
      return this._buildPublicState();
    }

    const px = player.x;
    const py = player.y;
    const minX = px - AOI_HALF_WIDTH;
    const maxX = px + AOI_HALF_WIDTH;
    const minY = py - AOI_HALF_HEIGHT;
    const maxY = py + AOI_HALF_HEIGHT;

    // Filter entity map by position
    const filterByAOI = (entities) => {
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
      players: this._sanitizePlayers(this.gameState.players), // always full
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
   * Calculer le delta entre deux états
   * @param {Object} current - État actuel
   * @param {Object} previous - État précédent
   * @returns {Object} Delta avec {updated, removed, meta}
   */
  calculateDelta(current, previous) {
    const delta = {
      updated: {},
      removed: {},
      meta: {}
    };

    // Listes des types d'entités à comparer
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
      const currentEntities = current[type] || {};
      const previousEntities = previous[type] || {};

      delta.updated[type] = {};
      delta.removed[type] = [];

      // Entités nouvelles ou modifiées
      for (const id in currentEntities) {
        const currentEntity = currentEntities[id];
        const previousEntity = previousEntities[id];

        if (!previousEntity || !this.shallowEqual(currentEntity, previousEntity)) {
          delta.updated[type][id] = currentEntity;
        }
      }

      // Entités supprimées
      for (const id in previousEntities) {
        if (!currentEntities[id]) {
          delta.removed[type].push(id);
        }
      }

      // Supprimer les clés vides
      if (Object.keys(delta.updated[type]).length === 0) {
        delete delta.updated[type];
      }
      if (delta.removed[type].length === 0) {
        delete delta.removed[type];
      }
    }

    // Meta-données (toujours envoyées)
    delta.meta = {
      wave: current.wave,
      walls: current.walls,
      currentRoom: current.currentRoom,
      bossSpawned: current.bossSpawned
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
    this.fullStateCounter++;

    // Graceful degradation: skip this tick when throttled
    const throttle = this._broadcastThrottleMultiplier();
    if (throttle > 1 && this.fullStateCounter % throttle !== 0) {
      return;
    }

    // LATENCY OPTIMIZATION: Skip broadcasts if no changes (idle optimization)
    const hasChanges = this._hasGameStateChanges();
    const isFull = this.fullStateCounter >= this.FULL_STATE_INTERVAL;
    if (!hasChanges && !isFull) {
      return; // Skip empty deltas
    }

    const serverTime = Date.now();
    const sockets = this.io.sockets && this.io.sockets.sockets
      ? this.io.sockets.sockets
      : null;

    if (isFull) {
      this.fullStateCounter = 0;
    }

    if (sockets) {
      // Per-player emit with AOI filtering
      sockets.forEach((socket) => {
        const socketId = socket.id;
        const publicState = this._buildPublicStateForPlayer(socketId);
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
          const delta = this.calculateDelta(publicState, prevState);
          delta.serverTime = serverTime;
          let updatedCount = 0;
          let removedCount = 0;
          for (const _ in delta.updated) {
 updatedCount++;
}
          for (const _ in delta.removed) {
 removedCount++;
}
          if (updatedCount > 0 || removedCount > 0) {
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
        this.io.emit('gameState', fullState);
      } else {
        const delta = this.calculateDelta(publicState, this.previousState);
        delta.serverTime = serverTime;
        if (Object.keys(delta.updated).length > 0 || Object.keys(delta.removed).length > 0) {
          this.io.emit('gameStateDelta', delta);
        }
      }

      this.previousState = clonedState;
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
    this.fullStateCounter = 0;
  }

  /**
   * LATENCY OPTIMIZATION: Start ping/pong monitoring for all connected players
   */
  startLatencyMonitoring() {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
    }

    this.pingIntervalTimer = setInterval(() => {
      const now = Date.now();

      // Send ping to all connected players
      for (const playerId in this.gameState.players) {
        const player = this.gameState.players[playerId];

        if (player && player.socketId) {
          // Send ping with timestamp
          this.io.to(player.socketId).emit('ping', { sentAt: now });

          // Initialize latency tracking for new players
          if (!this.playerLatencies[playerId]) {
            this.playerLatencies[playerId] = {
              latency: 0,
              lastPing: now,
              samples: []
            };
          } else {
            this.playerLatencies[playerId].lastPing = now;
          }
        }
      }
    }, this.PING_INTERVAL);
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
    }

    // Remove from latency tracking
    if (this.playerLatencies[playerId]) {
      delete this.playerLatencies[playerId];
    }

    // Remove per-player AOI previous state (memory cap: one entry per connected player)
    if (this.playerPreviousStates[playerId]) {
      delete this.playerPreviousStates[playerId];
    }
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
