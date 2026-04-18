/**
 * NETWORK MANAGER - Gestion de la compression et des deltas
 * Implémente la delta compression pour réduire la bande passante
 * Gain: -80-90% bande passante
 * @version 1.3.0 — perf/network-manager-overhaul
 */

const { SpatialGrid } = require('../../contexts/zombie/SpatialGrid');
const MetricsCollector = require('../../infrastructure/metrics/MetricsCollector');
const DeltaBuilder = require('./network/DeltaBuilder');
const BroadcastThrottler = require('./network/BroadcastThrottler');
const ReplayBuffer = require('./ReplayBuffer');

const replayBuffer = process.env.ENABLE_REPLAY === 'true' ? new ReplayBuffer() : null;

// AOI (Area of Interest) constants — 2× viewport, centered on player
const AOI_HALF_WIDTH = 1600; // px — 2× typical viewport width / 2
const AOI_HALF_HEIGHT = 900; // px — 2× typical viewport height / 2

// Cell size for the per-tick AOI spatial grid (px)
const AOI_GRID_CELL_SIZE = 256;

// Log sampling: emit the ">5ms" perf warning at most 1 in N ticks to avoid spam
const SLOW_EMIT_LOG_SAMPLE_RATE = 100;

// AOI bucket size (px) for per-tick publicState memoization. Sockets whose
// players fall in the same bucket share a single expanded-AOI filter pass.
// Trade-off: larger bucket = more sharing + more per-socket bandwidth;
// smaller = less sharing + tighter bandwidth. 400px matches typical player
// clustering during wave combat without overshooting the 3200×1800 AOI rect.
const AOI_BUCKET_SIZE = 400;

// Entity types subject to AOI spatial filtering
const AOI_FILTERED_TYPES = ['zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];

// PERF: module-level AOI filter — avoids creating a closure per socket per tick.
function _filterEntitiesByRect(entities, minX, maxX, minY, maxY) {
  const filtered = {};
  for (const id in entities) {
    const e = entities[id];
    if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
      filtered[id] = e;
    }
  }
  return filtered;
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
    // Fallback broadcast path (non-per-player delta): single reference state
    // compared against the full public snapshot. Active — used when per-player
    // AOI filtering is bypassed (see emitGameState fallback branch).
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

    // LATENCY OPTIMIZATION: Event batching queue
    this.eventBatchQueue = {}; // playerId -> {events: []}
    this.batchFlushTimer = null;
    this.BATCH_FLUSH_INTERVAL = 16; // 16ms (1 frame at 60 FPS)

    // LATENCY OPTIMIZATION: RTT (Round Trip Time) monitoring
    this.playerLatencies = {}; // playerId -> {latency, lastPing, samples: []}
    this.PING_INTERVAL = 2000; // Ping every 2 seconds
    this.MAX_LATENCY_SAMPLES = 10; // Keep last 10 samples for average
    this.pingIntervalTimer = null;

    // Sub-modules (composition)
    this._deltaBuilder = new DeltaBuilder();
    this._throttler = new BroadcastThrottler(this.playerLatencies);

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
      bossSpawned: null,
    };
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

    // PERF GC#7: reuse cached sanitized object — write fields in-place.
    const id = player.socketId || player.id;
    let sanitized = id ? this._sanitizedPlayerCache.get(id) : undefined;
    if (!sanitized) {
      sanitized = Object.create(null);
      if (id) this._sanitizedPlayerCache.set(id, sanitized);
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
   * Build a public state filtered to the player's Area of Interest (AOI).
   * Entities (zombies, bullets, powerups, loot, explosions, poisonTrails, particles)
   * are filtered to those within AOI_HALF_WIDTH × AOI_HALF_HEIGHT of the player.
   * players / walls / wave / currentRoom / bossSpawned are always unfiltered.
   * Falls back to unfiltered state when player position is unknown.
   * @param {string} playerId - Socket ID of the requesting player
   * @returns {Object} Filtered public state
   */
  /**
   * Compute the bucket key for a player position. Returns null when AOI
   * bucketing should be skipped (solo / small lobby / invalid position).
   * @param {object} player
   * @returns {string|null}
   */
  _aoiBucketKeyFor(player) {
    if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') {
      return null;
    }
    const bx = Math.floor(player.x / AOI_BUCKET_SIZE);
    const by = Math.floor(player.y / AOI_BUCKET_SIZE);
    return `${bx}:${by}`;
  }

  /**
   * Build the filtered publicState for an AOI bucket (shared by every socket
   * whose player sits in that bucket). Uses an expanded rect = bucket +
   * AOI_HALF_*. The extra bandwidth this costs per socket is dwarfed by the
   * ×N reduction in filter passes once N sockets converge on the same bucket.
   * @param {string} bucketKey - "bx:by" key from _aoiBucketKeyFor
   * @param {object} sanitizedPlayers
   * @returns {object} publicState
   */
  _buildPublicStateForBucket(bucketKey, sanitizedPlayers) {
    const [bx, by] = bucketKey.split(':').map(Number);
    const cellMinX = bx * AOI_BUCKET_SIZE;
    const cellMaxX = cellMinX + AOI_BUCKET_SIZE;
    const cellMinY = by * AOI_BUCKET_SIZE;
    const cellMaxY = cellMinY + AOI_BUCKET_SIZE;

    const minX = cellMinX - AOI_HALF_WIDTH;
    const maxX = cellMaxX + AOI_HALF_WIDTH;
    const minY = cellMinY - AOI_HALF_HEIGHT;
    const maxY = cellMaxY + AOI_HALF_HEIGHT;

    const gs = this.gameState;
    return {
      players: sanitizedPlayers || this._sanitizePlayers(gs.players),
      zombies: _filterEntitiesByRect(gs.zombies, minX, maxX, minY, maxY),
      bullets: _filterEntitiesByRect(gs.bullets, minX, maxX, minY, maxY),
      particles: {}, // dropped — cosmetic, client-generated on events
      poisonTrails: _filterEntitiesByRect(gs.poisonTrails, minX, maxX, minY, maxY),
      explosions: _filterEntitiesByRect(gs.explosions, minX, maxX, minY, maxY),
      powerups: _filterEntitiesByRect(gs.powerups, minX, maxX, minY, maxY),
      loot: _filterEntitiesByRect(gs.loot, minX, maxX, minY, maxY),
      wave: gs.wave,
      walls: gs.walls,
      currentRoom: gs.currentRoom,
      bossSpawned: gs.bossSpawned
    };
  }

  _buildPublicStateForPlayer(_playerId, sanitizedPlayers) {
    // AOI per-player filtering disabled — small game, flat broadcast is
    // cheaper than N cloneState+filter passes (at 10 clients the tick loop
    // fell from 60Hz to ~20Hz under AOI load).
    if (sanitizedPlayers) {
      return Object.assign(this._buildPublicState(), { players: sanitizedPlayers });
    }
    return this._buildPublicState();
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
   * @param {Object} current - État actuel (filtré AOI pour le socket)
   * @param {Object} previous - État précédent (filtré AOI pour le socket)
   * @param {Object} [authoritative] - État brut non filtré pour distinguer
   *   "sorti d'AOI" (à laisser orphan côté client) de "vraiment supprimé".
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
   * Émettre l'état du jeu (full ou delta) — per-player AOI filtering
   * Each socket receives only entities within its 2× viewport Area of Interest.
   * Full state is broadcast every FULL_STATE_INTERVAL ticks; deltas otherwise.
   * Per-player previousState map ensures correct delta computation after filtering.
   * LATENCY OPTIMIZATION: Throttled to reduce network spam under high load
   * RESILIENCE: Broadcast FPS halved when average latency > 500ms
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
      // AOI filtering removed — small game, flat shared state for all sockets.
      // cloneState happens once up front and is reused.
      const sharedState = this._buildPublicState();

      // Per-player emit with AOI filtering + per-socket adaptive throttle.
      // Sockets with latency > 150ms are broadcast at half cadence (skip every
      // other non-full tick). Full-state keyframes always go through to keep
      // the client buffer in sync.
      // AOI bucket cache: sockets in the same spatial bucket share one
      // filter pass. Cleared each tick (no cross-tick staleness risk).
      // PERF: reuse instance-level Map instead of allocating new Map() each tick.
      // Single shared delta for all sockets. io.emit() broadcasts once to
      // every connected socket. Previously we called calculateDelta + emit
      // per-socket, which was O(n_sockets × n_entities) every tick.
      const clonedSharedState = this.cloneState(sharedState);
      const sharedPrev = this.previousState || {};

      if (isFull) {
        const fullState = this._buildFullPayload(sharedState, serverTime);
        _bytesThisTick += this._estimatePayloadBytes(fullState);
        this.io.compress(false).emit('gameState', fullState);
      } else {
        const delta = this._buildDeltaPayload(sharedState, sharedPrev, serverTime);
        if (delta) {
          _bytesThisTick += this._estimatePayloadBytes(delta);
          this.io.compress(false).emit('gameStateDelta', delta);
          if (replayBuffer) {
            replayBuffer.record(delta);
          }
        }
      }
      this.previousState = clonedSharedState;
    } else {
      // Fallback: no socket map available — broadcast unfiltered (safety net)
      const publicState = this._buildPublicState();
      const clonedState = this.cloneState(publicState);

      if (isFull) {
        // compress:false: skip la tentative deflate (CF stripe de toute façon).
        // PAS de volatile: les deltas sont essentiels à l'interpolation des zombies côté client.
        const fullState = this._buildFullPayload(publicState, serverTime);
        this.io.compress(false).emit('gameState', fullState);
      } else {
        // PERF: for-in count instead of Object.keys() allocation (pool always has all type keys)
        const delta = this._buildDeltaPayload(publicState, this.previousState, serverTime);
        if (delta) {
          this.io.compress(false).emit('gameStateDelta', delta);
          if (replayBuffer) {
            replayBuffer.record(delta);
          }
        }
      }

      this.previousState = clonedState;
    }

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
        console.warn(
          `[NetworkManager] emitGameState took ${_elapsed.toFixed(2)}ms (>5ms threshold) [sampled 1/${SLOW_EMIT_LOG_SAMPLE_RATE}]`
        );
      }
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
      for (const _ in delta.updated[type]) { return delta; }
    }
    for (const type in delta.removed) {
      if (delta.removed[type].length > 0) { return delta; }
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
    this._deltaBuilder.reset();
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
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i] < min) {
 min = samples[i];
}
      if (samples[i] > max) {
 max = samples[i];
}
    }

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
      if (this.batchFlushTimer) {
        let hasQueues = false;
        for (const _ in this.eventBatchQueue) {
 hasQueues = true; break;
}
        if (!hasQueues) {
          clearTimeout(this.batchFlushTimer);
          this.batchFlushTimer = null;
        }
      }
    }

    // Remove from latency tracking
    if (this.playerLatencies[playerId]) {
      delete this.playerLatencies[playerId];
    }

    // Remove per-player AOI previous state (memory cap: one entry per connected player)
    this.playerPreviousStates.delete(playerId);

    // Remove per-socket room tracking entry + throttle skip flag
    this._deltaBuilder.cleanupSocket(playerId);
    this._throttler.cleanupSocket(playerId);
  }

  /**
   * Obtenir des stats réseau
   * @returns {Object}
   */
  getNetworkStats() {
    let queuedEvents = 0;
    let activePlayers = 0;
    for (const id in this.eventBatchQueue) {
      queuedEvents += this.eventBatchQueue[id].events.length;
      activePlayers++;
    }
    let hasPrev = false;
    for (const _ in this.previousState) {
 hasPrev = true; break;
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
module.exports.AOI_HALF_WIDTH = AOI_HALF_WIDTH;
module.exports.AOI_HALF_HEIGHT = AOI_HALF_HEIGHT;
module.exports.ANGLE_TO_RAD = ANGLE_TO_RAD;
module.exports.replayBuffer = replayBuffer;
