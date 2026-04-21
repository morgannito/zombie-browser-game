/**
 * NETWORK MANAGER - Gestion de la compression et des deltas
 * Implémente la delta compression pour réduire la bande passante
 * Gain: -80-90% bande passante
 * @version 1.3.0 — perf/network-manager-overhaul
 */

const logger = require('../../infrastructure/logging/Logger');
const MetricsCollector = require('../../infrastructure/metrics/MetricsCollector');
const DeltaBuilder = require('./network/DeltaBuilder');
const BroadcastThrottler = require('./network/BroadcastThrottler');
const EventBatchQueue = require('./network/EventBatchQueue');
const LatencyTracker = require('./network/LatencyTracker');
const ReplayBuffer = require('./ReplayBuffer');

const replayBuffer = process.env.ENABLE_REPLAY === 'true' ? new ReplayBuffer() : null;

// Log sampling: emit the ">5ms" perf warning at most 1 in N ticks to avoid spam
const SLOW_EMIT_LOG_SAMPLE_RATE = 100;

class NetworkManager {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    // Shared reference state for the broadcast loop.
    this.previousState = {};
    this.fullStateCounter = 0;
    this._slowEmitLogCounter = 0; // for SLOW_EMIT_LOG_SAMPLE_RATE throttle
    // PERF (latency): full state every 5 frames (~83ms @ 60Hz) instead of 10.
    // Late joiners and recovering clients resync 2× faster; bandwidth bump
    // is marginal because deltas remain the dominant payload.
    // Full snapshot every 5s (was every 83ms = 12Hz). At 40 KB/snap it was
    // saturating the uplink; deltas at 48Hz keep the client state fresh,
    // full-state is now just a periodic resync / reconnect safety net.
    this.FULL_STATE_INTERVAL = 300;

    this.PING_INTERVAL = 2000; // Ping every 2 seconds
    this.pingIntervalTimer = null;

    // Sub-modules (composition)
    this._latencyTracker = new LatencyTracker();
    this.playerLatencies = this._latencyTracker.latencies; // backward-compat alias
    this._eventBatchQueue = new EventBatchQueue(io);
    // expose legacy properties for external callers
    this.BATCH_FLUSH_INTERVAL = this._eventBatchQueue.FLUSH_INTERVAL;
    this._deltaBuilder = new DeltaBuilder();
    this._throttler = new BroadcastThrottler(this.playerLatencies);

    // PERF: Pre-allocated delta pool — reused each tick to avoid GC pressure.
    // Entity-type sub-objects are also pre-allocated and cleared in-place.
    const _entityTypes = [
      'players',
      'zombies',
      'bullets',
      'particles',
      'poisonTrails',
      'explosions',
      'powerups',
      'loot'
    ];
    this._deltaPool = { updated: {}, removed: {} };
    for (const t of _entityTypes) {
      this._deltaPool.updated[t] = {};
      this._deltaPool.removed[t] = [];
    }

    // PERF GC#7: reused sanitized player objects — written in-place each tick.
    this._sanitizedPlayerCache = new Map(); // socketId -> sanitized obj

    // PERF GC#8: pre-allocated public state buffer — reused each tick.
    this._publicStateBuf = {
      players: {},
      zombies: null,
      bullets: null,
      particles: {},
      poisonTrails: null,
      explosions: null,
      powerups: null,
      loot: null,
      wave: null,
      walls: null,
      currentRoom: null,
      bossSpawned: null
    };
  }

  /**
   * PERF: Reset pooled delta object in-place (avoids new allocation each tick).
   * Clears all entity-type sub-objects without re-allocating them.
   */
  _clearDeltaPool() {
    const u = this._deltaPool.updated;
    const r = this._deltaPool.removed;
    const types = [
      'players',
      'zombies',
      'bullets',
      'particles',
      'poisonTrails',
      'explosions',
      'powerups',
      'loot'
    ];
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

    // PERF GC#7: reuse cached sanitized object — write fields in-place.
    const id = player.socketId || player.id;
    let sanitized = id ? this._sanitizedPlayerCache.get(id) : undefined;
    if (!sanitized) {
      sanitized = Object.create(null);
      if (id) {
        this._sanitizedPlayerCache.set(id, sanitized);
      }
    }
    Object.assign(sanitized, player);
    sanitized.sessionId = undefined;
    sanitized.socketId = undefined;
    sanitized.accountId = undefined;
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
    // PERF GC#8: reuse pre-allocated buffer — write fields in-place.
    const buf = this._publicStateBuf;
    const gs = this.gameState;
    buf.players = this._sanitizePlayers(gs.players);
    buf.zombies = gs.zombies;
    buf.bullets = gs.bullets;
    // particles: intentionally omitted — cosmetic, client generates locally
    // on events (bullet hit, zombie death, explosion). Was ~9KB/tick.
    // buf.particles stays as pre-allocated {}
    buf.poisonTrails = gs.poisonTrails;
    buf.explosions = gs.explosions;
    buf.powerups = gs.powerups;
    buf.loot = gs.loot;
    buf.wave = gs.wave;
    buf.walls = gs.walls;
    buf.currentRoom = gs.currentRoom;
    buf.bossSpawned = gs.bossSpawned;
    return buf;
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
  /** @delegates DeltaBuilder._fieldDiff */
  _fieldDiff(cur, prev) {
    return this._deltaBuilder._fieldDiff(cur, prev);
  }

  /**
   * Calculer le delta entre deux états (field-diff optimisé)
   * @param {Object} current - État public actuel partagé
   * @param {Object} previous - État public précédent partagé
   * @param {Object} [authoritative] - État brut serveur pour distinguer une
   *   disparition logique d'une suppression réelle.
   * @returns {Object} Delta avec {updated, removed, meta}
   */
  /** @delegates DeltaBuilder.calculateDelta */
  calculateDelta(current, previous, authoritative = null, socketId = null) {
    return this._deltaBuilder.calculateDelta(current, previous, authoritative, socketId);
  }

  /**
   * Cloner l'état actuel pour la comparaison future (optimisé)
   * OPTIMISATION: Clone manuel au lieu de JSON.parse/stringify (3-5x plus rapide)
   * BOTTLENECK OPTIMIZATION: Use Object.assign instead of spread (faster, less allocations)
   * @param {Object} state
   * @returns {Object} Clone peu profond mais suffisant pour la comparaison
   */
  /** @delegates DeltaBuilder.cloneState */
  cloneState(state) {
    return this._deltaBuilder.cloneState(state);
  }

  /**
   * Compute the average latency across all tracked players.
   * Returns 0 when no data is available.
   * @returns {number} Average RTT in ms
   */
  /** @delegates BroadcastThrottler.getAverageLatency */
  getAverageLatency() {
    return this._throttler.getAverageLatency();
  }

  /** @delegates BroadcastThrottler._broadcastThrottleMultiplier */
  _broadcastThrottleMultiplier() {
    return this._throttler._broadcastThrottleMultiplier();
  }

  /** @delegates BroadcastThrottler._shouldSkipSocket */
  _shouldSkipSocket(socketId) {
    return this._throttler._shouldSkipSocket(socketId);
  }

  /**
   * Emit the shared game state snapshot (full or delta) to every client.
   * Full state is broadcast every FULL_STATE_INTERVAL ticks; deltas otherwise.
   * LATENCY OPTIMIZATION: broadcast cadence is reduced under high average latency.
   */
  emitGameState() {
    const _t0 = performance.now();
    // Rough byte counter for the broadcast_bytes histogram. We estimate
    // serialised size via JSON stringify once per socket — not free, but
    // only runs on the samples we already pay to build and it gives a
    // realistic p95 snapshot. msgpack payloads are typically ~30 % smaller
    // but the relative trend is what we want to track.
    let _bytesThisTick = 0;
    this.fullStateCounter++;

    // Graceful degradation: skip this tick when throttled
    const throttle = this._broadcastThrottleMultiplier();
    if (throttle > 1 && this.fullStateCounter % throttle !== 0) {
      return;
    }

    const isFull = this.fullStateCounter >= this.FULL_STATE_INTERVAL;
    const serverTime = Date.now();
    const sharedState = this._buildPublicState();
    const sharedPrev = this.previousState || {};

    if (isFull) {
      this.fullStateCounter = 0;
    }

    if (isFull) {
      const fullState = this._buildFullPayload(sharedState, serverTime);
      _bytesThisTick += this._estimatePayloadBytes(fullState);
      this._emitCompressed('gameState', fullState);
    } else {
      const delta = this._buildDeltaPayload(sharedState, sharedPrev, serverTime);
      if (delta) {
        _bytesThisTick += this._estimatePayloadBytes(delta);
        this._emitCompressed('gameStateDelta', delta);
        if (replayBuffer) {
          replayBuffer.record(delta);
        }
      }
    }
    this.previousState = this.cloneState(sharedState);

    const _elapsed = performance.now() - _t0;
    // Record to histograms — only count ticks that actually emitted something.
    const mc = MetricsCollector.getInstance();
    mc.recordBroadcastDuration(_elapsed);
    if (_bytesThisTick > 0) {
      mc.recordBroadcastBytes(_bytesThisTick);
    }
    if (_elapsed > 5) {
      this._slowEmitLogCounter++;
      if (this._slowEmitLogCounter % SLOW_EMIT_LOG_SAMPLE_RATE === 1) {
        logger.warn(
          `[NetworkManager] emitGameState took ${_elapsed.toFixed(2)}ms (>5ms threshold) [sampled 1/${SLOW_EMIT_LOG_SAMPLE_RATE}]`
        );
      }
    }
  }

  /**
   * Emit with compression disabled when socket.io exposes the helper; otherwise
   * fall back to a plain emit for lightweight fakes/bench callers.
   * @param {string} event
   * @param {object} payload
   */
  _emitCompressed(event, payload) {
    if (!this.io) {
      return;
    }
    if (typeof this.io.compress === 'function') {
      this.io.compress(false).emit(event, payload);
      return;
    }
    if (typeof this.io.emit === 'function') {
      this.io.emit(event, payload);
    }
  }

  /**
   * Build a full keyframe payload from a public state snapshot.
   * @param {object} state - output of _buildPublicState()
   * @param {number} serverTime
   * @returns {object}
   */
  _buildFullPayload(state, serverTime) {
    return {
      players: state.players,
      zombies: state.zombies,
      bullets: state.bullets,
      particles: state.particles,
      poisonTrails: state.poisonTrails,
      explosions: state.explosions,
      powerups: state.powerups,
      loot: state.loot,
      wave: state.wave,
      walls: state.walls,
      currentRoom: state.currentRoom,
      bossSpawned: state.bossSpawned,
      serverTime,
      full: true
    };
  }

  /**
   * Build a delta payload; returns null when nothing changed.
   * PERF: for-in instead of Object.keys() to avoid allocation.
   * @param {object} current
   * @param {object} prev
   * @param {number} serverTime
   * @returns {object|null}
   */
  _buildDeltaPayload(current, prev, serverTime) {
    const delta = this.calculateDelta(current, prev || {}, this.gameState);
    delta.serverTime = serverTime;
    for (const type in delta.updated) {
      for (const _ in delta.updated[type]) {
        return delta;
      }
    }
    for (const type in delta.removed) {
      if (delta.removed[type].length > 0) {
        return delta;
      }
    }
    return null;
  }

  /**
   * Estimate serialised payload size by JSON stringify length.
   * Approximation — msgpack wire size is ~30 % smaller, but for the
   * broadcast_bytes histogram we care about the relative trend, not the
   * absolute number.
   * @param {object} payload
   * @returns {number} byte count
   */
  /** @delegates DeltaBuilder._estimatePayloadBytes */
  _estimatePayloadBytes(payload) {
    return this._deltaBuilder._estimatePayloadBytes(payload);
  }

  /**
   * LATENCY OPTIMIZATION: Queue event for batching
   * @delegates EventBatchQueue.queue
   */
  queueEventForPlayer(playerId, event, data, immediate = false) {
    this._eventBatchQueue.queue(playerId, event, data, immediate);
  }

  /**
   * LATENCY OPTIMIZATION: Flush all batched events
   * @delegates EventBatchQueue.flush
   */
  flushEventBatches() {
    this._eventBatchQueue.flush();
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
    this._deltaBuilder.reset();
    this.fullStateCounter = 0;
  }

  /**
   * LATENCY OPTIMIZATION: Get player latency stats
   * @delegates LatencyTracker.getStats
   */
  getPlayerLatency(playerId) {
    return this._latencyTracker.getStats(playerId);
  }

  /**
   * LATENCY OPTIMIZATION: Cleanup on shutdown
   */
  cleanup() {
    this._eventBatchQueue.cleanup();

    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }

    this._latencyTracker.cleanup();
  }

  /**
   * CRITICAL FIX: Cleanup player data when they disconnect
   * Prevents memory leaks from abandoned latency/throttle tracking.
   * @param {string} playerId - Player ID (socket ID) to cleanup
   */
  cleanupPlayer(playerId) {
    // Remove from event batch queue and latency tracking
    this._eventBatchQueue.cleanupPlayer(playerId);
    this._latencyTracker.cleanupPlayer(playerId);

    // Remove per-socket room tracking entry + throttle skip flag
    this._deltaBuilder.cleanupSocket(playerId);
    this._throttler.cleanupSocket(playerId);
  }

  /**
   * Obtenir des stats réseau
   * @returns {Object}
   */
  getNetworkStats() {
    const { queuedEvents, activePlayers } = this._eventBatchQueue.getStats();
    let hasPrev = false;
    for (const _ in this.previousState) {
      hasPrev = true;
      break;
    }

    return {
      fullStateCounter: this.fullStateCounter,
      fullStateInterval: this.FULL_STATE_INTERVAL,
      hasPreviousState: hasPrev,
      batchedEventQueue: queuedEvents,
      activePlayers
    };
  }
}

module.exports = NetworkManager;
module.exports.replayBuffer = replayBuffer;
