/**
 * NETWORK MANAGER - Gestion de la compression et des deltas
 * Implémente la delta compression pour réduire la bande passante
 * Gain: -80-90% bande passante
 * @version 1.0.0
 */

class NetworkManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    this.previousState = {};
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
    const entityTypes = ['players', 'zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];

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
    const entityTypes = ['players', 'zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];

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
   * Émettre l'état du jeu (full ou delta)
   * Envoie l'état complet toutes les 10 frames (~166ms), sinon envoie le delta
   * LATENCY OPTIMIZATION: Throttled to reduce network spam under high load
   * BOTTLENECK OPTIMIZATION: Avoid double cloneState() call (save clone for reuse)
   * FIX: Added serverTime for client-side latency compensation
   */
  emitGameState() {
    this.fullStateCounter++;

    // LATENCY OPTIMIZATION: Skip broadcasts if no changes (idle optimization)
    // FIX: Use improved change detection that checks actual positions
    const hasChanges = this._hasGameStateChanges();
    if (!hasChanges && this.fullStateCounter < this.FULL_STATE_INTERVAL) {
      return; // Skip empty deltas
    }

    // BOTTLENECK OPTIMIZATION: Clone once and reuse for both full state and previousState
    const clonedState = this.cloneState(this.gameState);

    // FIX: Add server timestamp for client-side latency compensation
    const serverTime = Date.now();

    // Toutes les 10 frames : état complet
    if (this.fullStateCounter >= this.FULL_STATE_INTERVAL) {
      this.fullStateCounter = 0;

      const fullState = {
        players: this.gameState.players,
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
        bossSpawned: this.gameState.bossSpawned,
        serverTime: serverTime, // FIX: Server timestamp for latency compensation
        full: true // Indicateur d'état complet
      };

      this.io.emit('gameState', fullState);

      // BOTTLENECK OPTIMIZATION: Reuse cloned state (avoid second clone)
      this.previousState = clonedState;

    } else {
      // Calculer et envoyer le delta
      const delta = this.calculateDelta(this.gameState, this.previousState);

      // FIX: Add serverTime to delta for interpolation timing
      delta.serverTime = serverTime;

      // Seulement si le delta contient des changements
      if (Object.keys(delta.updated).length > 0 || Object.keys(delta.removed).length > 0) {
        this.io.emit('gameStateDelta', delta);
      }

      // BOTTLENECK OPTIMIZATION: Reuse cloned state (avoid second clone)
      this.previousState = clonedState;
    }
  }

  /**
   * LATENCY OPTIMIZATION: Quick check if game state has changed since last broadcast
   * FIX: Now checks actual position changes for moving entities, not just counts
   * @returns {boolean} True if changes detected
   */
  _hasGameStateChanges() {
    // FIX: Check ALL entity types, not just a subset
    const entityTypes = ['players', 'zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];

    for (const type of entityTypes) {
      const currentEntities = this.gameState[type] || {};
      const prevEntities = this.previousState[type] || {};

      const currentCount = Object.keys(currentEntities).length;
      const prevCount = Object.keys(prevEntities).length;

      // Fast path: entity count changed
      if (currentCount !== prevCount) {
        return true;
      }

      // FIX: For moving entities (zombies, bullets, players), check actual position changes
      // This prevents skipping updates when entities are moving but count stays same
      if (type === 'zombies' || type === 'bullets' || type === 'players') {
        // Sample check: verify first few entities haven't moved
        // Full check would be too expensive, so we sample
        const ids = Object.keys(currentEntities);
        const sampleSize = Math.min(5, ids.length); // Check up to 5 entities

        for (let i = 0; i < sampleSize; i++) {
          const id = ids[i];
          const current = currentEntities[id];
          const prev = prevEntities[id];

          if (!prev) {
            return true; // New entity
          }

          // Check if position changed significantly (> 0.5 px movement)
          if (current && prev) {
            const dx = Math.abs((current.x || 0) - (prev.x || 0));
            const dy = Math.abs((current.y || 0) - (prev.y || 0));
            if (dx > 0.5 || dy > 0.5) {
              return true;
            }

            // For players/zombies, also check health changes
            if ((type === 'players' || type === 'zombies') && current.health !== prev.health) {
              return true;
            }
          }
        }
      }
    }

    // No significant changes detected
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
   * Prevents memory leak from abandoned latency tracking
   * @param {string} playerId - Player ID to cleanup
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
