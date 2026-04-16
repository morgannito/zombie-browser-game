/**
 * GAME STATE MANAGER
 * Manages global game state, entity tracking, and debug features
 * Enhanced with adaptive interpolation and velocity-based smoothing
 * @module GameStateManager
 * @author Claude Code
 * @version 4.0.0
 */

class GameStateManager {
  constructor() {
    this.playerId = null;
    this.state = {
      players: {},
      zombies: {},
      bullets: {},
      powerups: {},
      particles: {},
      poisonTrails: {},
      explosions: {},
      loot: {},
      walls: [],
      currentRoom: 0,
      totalRooms: 5,
      doors: [],
      wave: 1,
      bossSpawned: false,
      // Environment systems
      parallax: null,
      staticProps: [],
      dynamicProps: [],
      dynamicPropParticles: [],
      envParticles: [],
      obstacles: []
    };
    this.config = {
      ROOM_WIDTH: 3000,
      ROOM_HEIGHT: 2400,
      PLAYER_SIZE: 20,
      ZOMBIE_SIZE: 25,
      POWERUP_SIZE: 15,
      LOOT_SIZE: 10
    };
    this.weapons = {};
    this.powerupTypes = {};
    this.zombieTypes = {};
    this.shopItems = {};

    // Enhanced visual interpolation system with velocity-based smoothing
    this.interpolation = {
      enabled: true,
      // PERF (latency): bumped 25 → 50. smoothFactor at 60 FPS goes from
      // ~33 % catch-up/frame to ~55 %, so a 100 px desync resolves in
      // ~80 ms instead of ~200 ms.
      baseSpeed: 50,
      // Entity state tracking for velocity-based interpolation
      entityStates: {
        zombies: new Map(),
        players: new Map()
      },
      // Performance tracking — base epoch (Date.now + serverTimeOffset once available)
      // so that lastFrameTime shares the same time base as snapshot timestamps
      // (server Date.now()) and renderTime in _stepEntity.
      lastFrameTime: Date.now(),
      deltaTime: 16.67
    };

    // Network latency tracking for adaptive behavior
    this.networkLatency = 50; // Initial estimate in ms
    this.serverTickRate = 20; // Expected server updates per second

    // Jitter tracking for adaptive interp delay
    this._jitter = 0; // Smoothed jitter estimate in ms
    this._lastPingMs = 50; // Last raw latency sample for jitter delta

    // FIX: Server time synchronization for latency compensation
    this.serverTimeOffset = 0; // (serverTime - clientTime) when packet was received
    this.lastServerTime = 0; // Last received server timestamp

    // CLIENT-SIDE PREDICTION: Predicted bullets for instant visual feedback
    this.predictedBullets = {};
    this.nextPredictedBulletId = 1;
    this.bulletPredictionEnabled = true;

    // Timestamp for state updates (to detect stale states)
    this.lastUpdateTimestamp = Date.now();

    // Debug mode (toggle with 'D' key)
    this.debugMode = false;
    this.debugStats = {
      entitiesCount: {},
      networkLatency: 0,
      lastUpdate: 0,
      interpolatedEntities: 0
    };
  }

  updateState(newState) {
    // BUGFIX (multi): merge instead of replace — preserve client-only env state
    // (parallax, staticProps, dynamicProps, envParticles, obstacles, doors, totalRooms)
    // that the server does not echo back in full-state broadcasts.
    const preserved = {
      parallax: this.state.parallax,
      staticProps: this.state.staticProps,
      dynamicProps: this.state.dynamicProps,
      dynamicPropParticles: this.state.dynamicPropParticles,
      envParticles: this.state.envParticles,
      obstacles: this.state.obstacles,
      doors: this.state.doors,
      totalRooms: this.state.totalRooms
    };
    this.state = Object.assign({}, this.state, newState);
    for (const key in preserved) {
      if (newState[key] === undefined && preserved[key] !== undefined) {
        this.state[key] = preserved[key];
      }
    }
    // Stamp authoritative server coordinates on interpolated entity types so
    // _applyServerUpdate can distinguish a real server push from display-position
    // drift written back by _stepEntity (full-state path; delta path stamps in
    // NetworkManager.handleGameStateDelta).
    const INTERPOLATED = ['zombies', 'players'];
    for (const type of INTERPOLATED) {
      const entities = this.state[type];
      if (!entities) {
        continue;
      }
      for (const id in entities) {
        const e = entities[id];
        if (e && e.x !== undefined) {
          e._serverX = e.x;
          e._serverY = e.y;
        }
      }
    }
    this.lastUpdateTimestamp = Date.now();
  }

  getPlayer() {
    return this.state.players[this.playerId];
  }

  initialize(data) {
    this.playerId = data.playerId;
    this.config = data.config;
    this.weapons = data.weapons;
    this.powerupTypes = data.powerupTypes;
    this.zombieTypes = data.zombieTypes;
    this.shopItems = data.shopItems;
    // Walls arrive in init — copy them immediately so client wall-collision
    // has the map data before the first movement frame (prevents walking
    // through walls + teleport-correction combo during the 16ms init gap).
    if (data.walls) {
      this.state.walls = data.walls;
    }
  }

  /**
   * Update network latency estimate (called from NetworkManager)
   * @param {number} latency - Measured latency in ms
   */
  updateNetworkLatency(latency) {
    // Exponential moving average for smooth latency tracking
    this.networkLatency = this.networkLatency * 0.8 + latency * 0.2;

    // Track jitter (variation between successive samples)
    const delta = Math.abs(latency - this._lastPingMs);
    this._jitter = this._jitter * 0.85 + delta * 0.15;
    this._lastPingMs = latency;
  }

  /**
   * Compute the adaptive interpolation delay.
   * Base 100ms; bumped to 200ms when jitter > 50ms (unstable link).
   * @returns {number} delay in ms
   */
  _adaptiveInterpDelay() {
    return this._jitter > 50 ? 200 : 100;
  }

  /**
   * FIX: Update server time offset for latency compensation
   * Called when receiving gameState or delta with serverTime
   * @param {number} serverTime - Server timestamp from the packet
   */
  updateServerTime(serverTime) {
    const clientTime = Date.now();
    this.lastServerTime = serverTime;

    // Calculate offset (how far ahead server is from client)
    // Positive = server ahead, Negative = client ahead
    const newOffset = serverTime - clientTime;

    // Use exponential moving average for stability (avoid jitter from network variance)
    // Blend factor 0.2 means 20% new value, 80% old (smooth but responsive)
    if (this.serverTimeOffset === 0) {
      // First measurement - use directly
      this.serverTimeOffset = newOffset;
    } else {
      this.serverTimeOffset = this.serverTimeOffset * 0.8 + newOffset * 0.2;
    }
  }

  /**
   * FIX: Get estimated current server time
   * Useful for time-sensitive interpolation calculations
   * @returns {number} Estimated current server time
   */
  getEstimatedServerTime() {
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * FIX: Get time since last server update (accounts for latency)
   * @returns {number} Milliseconds since server generated the last state
   */
  getTimeSinceServerUpdate() {
    if (this.lastServerTime === 0) {
      return 0;
    }
    return this.getEstimatedServerTime() - this.lastServerTime;
  }

  /**
   * Apply visual interpolation to entities for smooth movement.
   * Top-level dispatcher — frame-budget guard applied here.
   * Call this in the render loop, not in network handlers.
   */
  applyInterpolation() {
    if (!this.interpolation.enabled) {
      return;
    }

    // CRITICAL FIX (zombie freeze on player move):
    // Snapshots are stamped with server `Date.now()` (Unix epoch ~1.7e12 ms)
    // via entity._serverTime. Previously `now = performance.now()` (page-load
    // relative, ~60000 ms) → renderTime was ALWAYS <= snaps[0].t → Case 2
    // held every zombie at the oldest buffered snapshot. Align now on the
    // estimated server clock so renderTime and snapshot.t share the same base.
    const now = this.getEstimatedServerTime();
    const rawDelta = now - this.interpolation.lastFrameTime;
    this.interpolation.lastFrameTime = now;

    // Frame-budget guard: if delta > 500ms (tab was hidden, GC pause, etc.)
    // skip extrapolation entirely to avoid post-stall teleports.
    // 100ms was too aggressive — a single heavy GC tick or brief background tab
    // would disable extrapolation for the next frame, causing a visible freeze.
    const deltaTime = Math.min(rawDelta, 100);
    this.interpolation.deltaTime = deltaTime;
    const skipExtrapolation = rawDelta > 500;

    // smoothFactor kept for API compatibility (no longer used in _stepEntity
    // which uses the temporal buffer, but still accepted as a parameter).
    const effectiveSpeed = this._adaptiveSpeed();
    const smoothFactor = 1 - Math.exp((-effectiveSpeed * deltaTime) / 1000);

    this.debugStats.interpolatedEntities = 0;
    this._interpolateZombies(now, smoothFactor, skipExtrapolation);
    this._interpolatePlayers(now, smoothFactor, skipExtrapolation);
    this._interpolateBullets(now, smoothFactor, skipExtrapolation);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute effective interpolation speed.
   * Bumps to 35 when latency > 300ms so clients catch up faster; capped at 40.
   * @returns {number}
   */
  _adaptiveSpeed() {
    const base = this.interpolation.baseSpeed; // 50
    if (this.networkLatency > 300) {
      // High-latency boost: catch up faster when packets arrive late.
      return Math.min(80, base + 20);
    }
    return base;
  }

  /**
   * Build or update the velocity/position tracking state for one entity.
   * @param {Map} map - entityStates map
   * @param {string} id
   * @param {Object} entity - live entity with .x, .y
   * @param {number} now
   * @returns {Object} state
   */
  _getOrInitState(map, id, entity, now) {
    let state = map.get(id);
    if (!state) {
      // Pre-seed the snapshot buffer with a fake old snapshot so that the first
      // real _applyServerUpdate can interpolate immediately. Without this,
      // renderTime (= now - 100ms) is always before the first snapshot,
      // forcing Case 2 fallback for ~100ms — visible as "zombies freeze when
      // entering view". This is critical during camera movement where AOI
      // churn constantly introduces new entities.
      const seedT = now - 100;
      state = {
        serverX: entity.x,
        serverY: entity.y,
        displayX: entity.x,
        displayY: entity.y,
        targetX: entity.x,
        targetY: entity.y,
        velocityX: 0,
        velocityY: 0,
        lastUpdateTime: now,
        snapshots: [{ x: entity.x, y: entity.y, t: seedT }]
      };
      map.set(id, state);
    }
    return state;
  }

  /**
   * Detect a real server position update and refresh velocity.
   *
   * REGRESSION FIX: _stepEntity overwrites entity.x/y with the interpolated
   * display position each frame. Without a dedicated server-coord stamp, on
   * frames without a new delta entity.x (display) ≠ state.serverX (target),
   * causing a spurious backward velocity up to −120 px/frame that the widened
   * 150ms / 120px extrapolation window amplifies into a visible teleport.
   *
   * NetworkManager now stamps entity._serverX/_serverY on every delta push;
   * updateState stamps them on every full-state push. _applyServerUpdate reads
   * the stamp and clears it so subsequent frames without new server data
   * correctly skip the update entirely.
   *
   * @param {Object} state
   * @param {Object} entity
   * @param {number} now
   */
  /**
   * @param {Object} state
   * @param {Object} entity
   * @param {number} now - estimated server epoch (Date.now + serverTimeOffset)
   * @param {number} [serverTime] - authoritative server timestamp (ms); falls back to now
   */
  _applyServerUpdate(state, entity, now, _serverTime) {
    // Only process when the entity carries a fresh server-coordinate stamp.
    // The stamp is set by:
    //   - NetworkManager.handleGameStateDelta  (delta path)
    //   - GameStateManager.updateState         (full-state path)
    // and cleared here after processing so subsequent frames without new
    // server data correctly skip the update.  This prevents the spurious
    // backward-velocity spike that occurred when _stepEntity overwrote
    // entity.x/y with the interpolated display position and the old code
    // misread that as a new server push.
    if (entity._serverX === undefined) {
      return; // No new server data this frame
    }
    const newX = entity._serverX;
    const newY = entity._serverY;
    // Carry serverTime on stamp so _applyServerUpdate can use it
    const snapshotT = entity._serverTime !== undefined ? entity._serverTime : now;
    entity._serverX = undefined;
    entity._serverY = undefined;
    entity._serverTime = undefined;

    if (newX === state.serverX && newY === state.serverY) {
      return; // Position unchanged on server — skip update
    }

    // Push snapshot into ringbuffer (max 8 entries)
    // 8 snaps @ 30Hz = ~267ms window — enough to cover 100ms interp delay with
    // 4+ samples to interpolate between, vs. only 2 usable segments at 4 snaps.
    state.snapshots.push({ x: newX, y: newY, t: snapshotT });
    if (state.snapshots.length > 8) {
      state.snapshots.shift();
    }

    const elapsed = now - state.lastUpdateTime;
    const dx = newX - state.serverX;
    const dy = newY - state.serverY;
    if (elapsed > 0 && elapsed < 500) {
      state.velocityX = (dx / elapsed) * 1000;
      state.velocityY = (dy / elapsed) * 1000;
    } else {
      state.velocityX = 0;
      state.velocityY = 0;
    }
    state.serverX = newX;
    state.serverY = newY;
    state.targetX = newX;
    state.targetY = newY;
    state.lastUpdateTime = now;
    // AOI re-entry fix: if the entity jumped far (>200px) after >500ms of
    // silence (typical AOI re-entry after it left and came back), snap the
    // display position instead of smoothing. Avoids visible "glide" artifact
    // perceived as teleport.
    const JUMP_PX_SQ = 200 * 200;
    if (elapsed >= 500 && dx * dx + dy * dy > JUMP_PX_SQ) {
      state.displayX = newX;
      state.displayY = newY;
      // Seed buffer with two snapshots spanning the interpolation delay so
      // _stepEntity can lerp immediately (prevents ~100ms freeze on re-entry).
      state.snapshots = [
        { x: newX, y: newY, t: snapshotT - 100 },
        { x: newX, y: newY, t: snapshotT }
      ];
    }
  }

  /**
   * Temporal interpolation buffer: position entity at renderTime = now - 100ms.
   * Uses the snapshot ringbuffer for intra-packet interpolation; falls back to
   * velocity extrapolation (capped at 75ms) when renderTime is ahead of the
   * last known snapshot (packet late or buffer not yet seeded).
   *
   * @param {Object} state
   * @param {Object} entity - written back (.x, .y updated)
   * @param {number} now - estimated server epoch (matches snapshot.t time base)
   * @param {number} _smoothFactor - unused (kept for API compat)
   * @param {boolean} skipExtrapolation
   */
  _stepEntity(state, entity, now, _smoothFactor, skipExtrapolation) {
    // Adaptive interp delay: 100ms on stable link, 200ms when jitter > 50ms.
    const INTERP_DELAY = this._adaptiveInterpDelay();
    const MAX_EXTRAP_MS = 75; // cap on extrapolation when buffer is ahead of renderTime
    // Gap threshold: if two consecutive snapshots are >200ms apart, extrapolate
    // by velocity instead of freezing on the earlier keyframe.
    const GAP_EXTRAP_THRESHOLD_MS = 200;

    const renderTime = now - INTERP_DELAY;
    const snaps = state.snapshots;

    // ── Case 1: not enough snapshots yet — fall back to target directly ──────
    if (snaps.length === 0) {
      entity.x = state.displayX;
      entity.y = state.displayY;
      return;
    }

    // ── Min-buffer guard: wait for ≥3 snapshots to avoid extrapolation-only ──
    // rendering during the first ~200ms of entity lifetime. If we have fewer,
    // hold the last known position — far less jarring than a single-frame glide.
    if (snaps.length < 3 && renderTime > snaps[snaps.length - 1].t) {
      entity.x = snaps[snaps.length - 1].x;
      entity.y = snaps[snaps.length - 1].y;
      state.displayX = entity.x;
      state.displayY = entity.y;
      return;
    }

    // ── Case 2: renderTime is BEFORE the oldest snapshot (buffer just seeded) ─
    // With only 1 snapshot, holding frozen is better than nothing but still causes
    // a visible stutter. Extrapolate with the last known velocity so the entity
    // keeps gliding until the next snapshot arrives.
    if (renderTime <= snaps[0].t) {
      if (snaps.length === 1 && !skipExtrapolation) {
        const overtime = Math.min(snaps[0].t - renderTime, MAX_EXTRAP_MS);
        // Extrapolate *backward* (renderTime < snaps[0].t → negative dt)
        const t = -overtime / 1000;
        entity.x = snaps[0].x + state.velocityX * t;
        entity.y = snaps[0].y + state.velocityY * t;
      } else {
        entity.x = snaps[0].x;
        entity.y = snaps[0].y;
      }
      state.displayX = entity.x;
      state.displayY = entity.y;
      return;
    }

    const last = snaps[snaps.length - 1];

    // ── Case 3: renderTime is AFTER the newest snapshot — extrapolate ─────────
    if (renderTime >= last.t) {
      if (skipExtrapolation) {
        entity.x = last.x;
        entity.y = last.y;
        state.displayX = last.x;
        state.displayY = last.y;
        return;
      }
      // Cap extrapolation to MAX_EXTRAP_MS beyond the last snapshot
      const overtime = Math.min(renderTime - last.t, MAX_EXTRAP_MS);
      const t = overtime / 1000;
      entity.x = last.x + state.velocityX * t;
      entity.y = last.y + state.velocityY * t;
      state.displayX = entity.x;
      state.displayY = entity.y;
      return;
    }

    // ── Case 4: renderTime sits between two snapshots — interpolate ───────────
    for (let i = 1; i < snaps.length; i++) {
      const a = snaps[i - 1];
      const b = snaps[i];
      if (renderTime >= a.t && renderTime < b.t) {
        const span = b.t - a.t;
        // Gap >200ms: extrapolate by velocity from 'a' instead of lerping into
        // a stale keyframe — avoids the "zombie teleports on reappearance" freeze.
        if (span > GAP_EXTRAP_THRESHOLD_MS && !skipExtrapolation) {
          const elapsed = Math.min(renderTime - a.t, MAX_EXTRAP_MS);
          entity.x = a.x + state.velocityX * (elapsed / 1000);
          entity.y = a.y + state.velocityY * (elapsed / 1000);
        } else {
          const alpha = span > 0 ? (renderTime - a.t) / span : 0;
          entity.x = a.x + (b.x - a.x) * alpha;
          entity.y = a.y + (b.y - a.y) * alpha;
        }
        state.displayX = entity.x;
        state.displayY = entity.y;
        return;
      }
    }

    // Fallback (should not be reached)
    entity.x = last.x;
    entity.y = last.y;
    state.displayX = last.x;
    state.displayY = last.y;
  }

  /**
   * Interpolate all zombies.
   * @param {number} now
   * @param {number} smoothFactor
   * @param {boolean} skipExtrapolation
   */
  _interpolateZombies(now, smoothFactor, skipExtrapolation) {
    const map = this.interpolation.entityStates.zombies;

    for (const [id, zombie] of Object.entries(this.state.zombies)) {
      const state = this._getOrInitState(map, id, zombie, now);
      this._applyServerUpdate(state, zombie, now, zombie._serverTime);
      this._stepEntity(state, zombie, now, smoothFactor, skipExtrapolation);
      this.debugStats.interpolatedEntities++;
    }

    // Clean up states for removed zombies
    for (const [id] of map) {
      if (!this.state.zombies[id]) {
        map.delete(id);
      }
    }
  }

  /**
   * Interpolate remote players (local player is skipped).
   * @param {number} now
   * @param {number} smoothFactor
   * @param {boolean} skipExtrapolation
   */
  _interpolatePlayers(now, smoothFactor, skipExtrapolation) {
    const map = this.interpolation.entityStates.players;

    for (const [id, player] of Object.entries(this.state.players)) {
      if (id === this.playerId) {
        // Apply smooth lerp correction if one was queued by handlePositionCorrection.
        // This avoids the visible teleport of a hard snap for small isolated corrections.
        // Uses Date.now() (not `now` which is server-epoch) to stay on the same time
        // base as ct.startTime, written by NetworkManager with Date.now().
        if (player._correctionTarget) {
          const ct = player._correctionTarget;
          const elapsed = Date.now() - ct.startTime;
          if (elapsed >= ct.duration) {
            player.x = ct.x;
            player.y = ct.y;
            delete player._correctionTarget;
          } else {
            const t = elapsed / ct.duration;
            player.x += (ct.x - player.x) * t;
            player.y += (ct.y - player.y) * t;
          }
        }
        continue; // Skip remote interpolation for local player
      }
      const state = this._getOrInitState(map, id, player, now);
      this._applyServerUpdate(state, player, now, player._serverTime);
      this._stepEntity(state, player, now, smoothFactor, skipExtrapolation);
      this.debugStats.interpolatedEntities++;
    }

    // Clean up states for removed players
    for (const [id] of map) {
      if (!this.state.players[id]) {
        map.delete(id);
      }
    }
  }

  /**
   * Bullets move deterministically — no velocity extrapolation needed.
   * This method exists as the prescribed extension point; currently a no-op
   * beyond counting (server bullets are rendered via getAllBulletsForRendering).
   * @param {number} _now
   * @param {number} _smoothFactor
   * @param {boolean} _skipExtrapolation
   */
  _interpolateBullets(_now, _smoothFactor, _skipExtrapolation) {
    // Bullets are moved server-authoritatively; client predicted bullets are
    // handled by updatePredictedBullets(). Nothing to interpolate here.
  }

  /**
   * Clean up orphaned entities that no longer exist on server
   * Entities that haven't been updated in > 10 seconds are removed
   */
  cleanupOrphanedEntities() {
    const now = Date.now();
    const ORPHAN_TIMEOUT = 10000; // 10 seconds (increased to handle lag)

    ['zombies', 'bullets', 'particles', 'powerups', 'loot', 'explosions', 'poisonTrails'].forEach(
      type => {
        if (!this.state[type]) {
          return;
        }

        for (const [id, entity] of Object.entries(this.state[type])) {
          if (!entity._lastSeen) {
            entity._lastSeen = now;
          }

          // Remove if not updated recently
          if (now - entity._lastSeen > ORPHAN_TIMEOUT) {
            console.log(`[CLEANUP] Removing orphaned ${type} entity:`, id);
            delete this.state[type][id];
          }
        }
      }
    );
  }

  /**
   * Mark entity as seen (called when receiving server update)
   */
  markEntitySeen(type, id) {
    if (this.state[type] && this.state[type][id]) {
      this.state[type][id]._lastSeen = Date.now();
    }
  }

  /**
   * Update debug statistics — throttled to 500ms + for-in counters (no allocation).
   */
  updateDebugStats() {
    if (!this._debugStatsNext || performance.now() >= this._debugStatsNext) {
      this._debugStatsNext = performance.now() + 500;
      const count = o => {
        let n = 0;
        if (o) {
          for (const _k in o) {
            n++;
          }
        }
        return n;
      };
      this.debugStats.entitiesCount = {
        players: count(this.state.players),
        zombies: count(this.state.zombies),
        bullets: count(this.state.bullets),
        particles: count(this.state.particles),
        powerups: count(this.state.powerups),
        loot: count(this.state.loot)
      };
    }
    this.debugStats.lastUpdate = Date.now() - this.lastUpdateTimestamp;
  }

  /**
   * Toggle debug mode
   */
  toggleDebug() {
    this.debugMode = !this.debugMode;
    console.log('[DEBUG] Debug mode:', this.debugMode ? 'ENABLED' : 'DISABLED');
  }

  /**
   * CLIENT-SIDE PREDICTION: Create a predicted bullet for instant visual feedback
   * @param {number} x - Start X position
   * @param {number} y - Start Y position
   * @param {number} angle - Bullet direction in radians
   * @param {string} weaponType - Weapon type for bullet properties
   * @returns {Object} The predicted bullet object
   */
  createPredictedBullet(x, y, angle, weaponType) {
    if (!this.bulletPredictionEnabled) {
      return null;
    }

    // FIX: Validate inputs to prevent NaN positions
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle)) {
      console.warn('[BULLET] Invalid predicted bullet params:', { x, y, angle });
      return null;
    }

    const weapon = this.weapons[weaponType] || this.weapons.pistol;
    const bulletSpeed = weapon.bulletSpeed || 15;
    const bulletColor = weapon.color || '#ffff00';
    const bulletSize = weapon.bulletSize || this.config.BULLET_SIZE || 5;
    const bulletCount = weapon.bulletCount || 1;

    // Create predicted bullets (matching server-side bullet creation)
    for (let i = 0; i < bulletCount; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * (weapon.spread || 0);

      const predictedBullet = {
        id: `predicted_${this.nextPredictedBulletId++}`,
        x: x,
        y: y,
        vx: Math.cos(spreadAngle) * bulletSpeed,
        vy: Math.sin(spreadAngle) * bulletSpeed,
        color: bulletColor,
        size: bulletSize,
        createdAt: Date.now(),
        maxLifetime: 2000, // 2 second max lifetime for predicted bullets
        isPredicted: true
      };

      this.predictedBullets[predictedBullet.id] = predictedBullet;
    }
  }

  /**
   * CLIENT-SIDE PREDICTION: Update predicted bullets (called every frame)
   * Moves bullets, checks collisions with zombies/walls, and removes expired ones
   */
  updatePredictedBullets() {
    if (!this.bulletPredictionEnabled) {
      return;
    }

    const now = Date.now();
    const bulletIds = Object.keys(this.predictedBullets);
    const zombies = this.state.zombies;
    const walls = this.state.walls || [];
    const zombieSize = this.config.ZOMBIE_SIZE || 25;
    const bulletBaseSize = this.config.BULLET_SIZE || 5;

    for (let i = 0; i < bulletIds.length; i++) {
      const bulletId = bulletIds[i];
      const bullet = this.predictedBullets[bulletId];

      if (!bullet) {
        continue;
      }

      // Update position
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;

      // Remove if expired or out of bounds
      const age = now - bullet.createdAt;
      const outOfBounds =
        bullet.x < 0 ||
        bullet.x > this.config.ROOM_WIDTH ||
        bullet.y < 0 ||
        bullet.y > this.config.ROOM_HEIGHT;

      if (age > bullet.maxLifetime || outOfBounds) {
        delete this.predictedBullets[bulletId];
        continue;
      }

      // Check collision with walls (client-side visual feedback)
      let hitWall = false;
      for (let w = 0; w < walls.length; w++) {
        const wall = walls[w];
        if (
          bullet.x >= wall.x &&
          bullet.x <= wall.x + wall.width &&
          bullet.y >= wall.y &&
          bullet.y <= wall.y + wall.height
        ) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        delete this.predictedBullets[bulletId];
        continue;
      }

      // Check collision with zombies (client-side visual feedback)
      const bulletSize = bullet.size || bulletBaseSize;
      let hitZombie = false;
      for (const zombieId in zombies) {
        const zombie = zombies[zombieId];
        if (!zombie || zombie.isDead) {
          continue;
        }

        const dx = bullet.x - zombie.x;
        const dy = bullet.y - zombie.y;
        const distSq = dx * dx + dy * dy;
        const minDist = bulletSize + (zombie.size || zombieSize);

        if (distSq < minDist * minDist) {
          hitZombie = true;
          break;
        }
      }
      if (hitZombie) {
        delete this.predictedBullets[bulletId];
        continue;
      }
    }
  }

  /**
   * CLIENT-SIDE PREDICTION: Get all bullets for rendering (server + predicted)
   * @returns {Object} Combined bullets object
   */
  getAllBulletsForRendering() {
    // Merge server bullets with predicted bullets
    // Server bullets take precedence (they have real IDs)
    return { ...this.predictedBullets, ...this.state.bullets };
  }

  /**
   * CLIENT-SIDE PREDICTION: Clear old predicted bullets when server state arrives
   * This prevents visual doubling of bullets
   */
  reconcilePredictedBullets() {
    const now = Date.now();
    // Use network latency to determine reconciliation age
    // Add buffer for processing delays (min 150ms to account for RTT + server processing)
    const RECONCILIATION_AGE = Math.max(150, this.networkLatency * 1.5 + 50);

    // If we have server bullets, remove old predicted bullets
    const serverBulletCount = Object.keys(this.state.bullets).length;
    if (serverBulletCount > 0) {
      const bulletIds = Object.keys(this.predictedBullets);
      for (let i = 0; i < bulletIds.length; i++) {
        const bulletId = bulletIds[i];
        const bullet = this.predictedBullets[bulletId];
        if (!bullet) {
          continue;
        }

        const age = now - bullet.createdAt;

        // Remove predicted bullets that are old enough to have been reconciled with server
        if (age > RECONCILIATION_AGE) {
          delete this.predictedBullets[bulletId];
        }
      }
    }
  }
}

// Export to window
window.GameStateManager = GameStateManager;
