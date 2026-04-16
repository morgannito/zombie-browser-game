/**
 * NETWORK MANAGER
 * Handles Socket.IO communication with the game server
 * @module NetworkManager
 * @author Claude Code
 * @version 2.1.0 — perf/network-manager-overhaul
 */

// Angle dequantisation constant: byte (0-255) → radians.
// Matches server quantiseAngle: byte = round(normalised / 2π × 255).
// Defined once at module level — not re-created on every delta handler call.
const ANGLE_TO_RAD = (Math.PI * 2) / 255;

class NetworkManager {
  constructor(socket) {
    this.socket = socket;
    this.justReconnected = false; // Flag to track reconnection state
    this._initialConnect = true; // True until the first successful connect
    this.listeners = []; // Track all listeners for cleanup

    // Latency monitoring
    this.latency = 0; // Current latency in ms
    this.lastPingTime = 0;
    this.latencyHistory = []; // Keep last 10 measurements
    this.maxLatencyHistory = 10;
    this._lastLatencyWarnAt = 0; // Throttle high-latency log (once per 5 s)

    // Outbound emit batch queue (flushed via queueMicrotask within same rAF tick)
    this._emitQueue = [];
    this._emitFlushPending = false;

    // Exponential backoff reconnect state
    this._reconnectAttempts = 0;
    this._reconnectBackoffMs = 1000; // initial delay
    this._reconnectMaxBackoffMs = 30000;
    this._reconnectTimer = null;

    this.setupSocketListeners();
    this.setupLatencyMonitoring();
  }

  /**
   * Schedule a manual reconnect attempt with exponential backoff.
   * Called when Socket.IO's built-in reconnect is exhausted or on explicit disconnect.
   * @private
   */
  _scheduleReconnect() {
    if (this._reconnectTimer) {
      return; // already scheduled
    }

    const delay = Math.min(
      this._reconnectBackoffMs * Math.pow(2, this._reconnectAttempts),
      this._reconnectMaxBackoffMs
    );
    this._reconnectAttempts++;

    console.log(
      `[Network] Scheduling reconnect in ${delay}ms (attempt ${this._reconnectAttempts})`
    );

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  /** Reset backoff state after successful connection. @private */
  _resetReconnectBackoff() {
    this._reconnectAttempts = 0;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /**
   * Request a full authoritative game state from the server after reconnection.
   * Emits 'requestFullState'. If the server does not handle this event it is a
   * silent no-op — no error is thrown.
   * @private
   */
  _syncFullState() {
    if (this.socket.connected) {
      this.socket.emit('requestFullState');
    }
  }

  /**
   * Batch-queue an emit and flush via queueMicrotask (once per microtask checkpoint).
   * Avoids redundant socket writes when multiple emits land in the same rAF tick.
   * @param {string} event
   * @param {*} payload
   */
  _queueEmit(event, payload) {
    this._emitQueue.push({ event, payload });
    if (!this._emitFlushPending) {
      this._emitFlushPending = true;
      queueMicrotask(() => {
        this._emitFlushPending = false;
        const queue = this._emitQueue.splice(0);
        queue.forEach(({ event: ev, payload: pl }) => {
          this.socket.emit(ev, pl);
        });
      });
    }
  }

  /**
   * Register event listener and track it for cleanup
   */
  on(event, handler) {
    this.socket.on(event, handler);
    this.listeners.push({ event, handler });
  }

  /**
   * Remove all registered listeners to prevent memory leaks
   */
  cleanup() {
    this.listeners.forEach(({ event, handler }) => {
      this.socket.off(event, handler);
    });
    this.listeners = [];

    // Clear ping interval
    if (this.pingIntervalId && window.timerManager) {
      window.timerManager.clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    } else if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Clear pending reconnect timer
    this._resetReconnectBackoff();
  }

  setupLatencyMonitoring() {
    // Single-source RTT: client-initiated ping with ack callback only.
    // The old app:ping/app:pong listener pair has been removed — the server
    // responds via ack, never via an app:pong emit, so that listener was a
    // dead code path that never fired.
    // The first 2 samples are discarded (cold-start / TCP slow-start skew).
    this._warmupSamplesRemaining = 2;

    const doPing = () => {
      if (this.socket.connected) {
        const start = performance.now();
        this.socket.emit('app:ping', start, _ack => {
          const latency = Math.round(performance.now() - start);
          this.updateLatency(latency);
        });
      }
    };

    const timerMgr = window.timerManager;
    if (timerMgr) {
      this.pingIntervalId = timerMgr.setInterval(doPing, 2000);
    } else {
      this.pingInterval = setInterval(doPing, 2000);
    }
  }

  updateLatency(latency) {
    // Discard cold-start samples (TCP slow-start / first-packet overhead).
    if (this._warmupSamplesRemaining > 0) {
      this._warmupSamplesRemaining--;
      return;
    }

    this.latency = latency;

    // Add to history
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }

    // Update UI indicator if available
    this.updateLatencyIndicator();

    // Update GameStateManager with latency for adaptive interpolation
    if (window.gameState && window.gameState.updateNetworkLatency) {
      window.gameState.updateNetworkLatency(latency);
    }

    // Log high latency warnings — throttled to once every 5 s to avoid log spam.
    // Threshold raised to 300ms (ping ICMP ~25ms; 200ms was too noisy in practice).
    if (latency > 300) {
      const now = performance.now();
      if (now - this._lastLatencyWarnAt >= 5000) {
        this._lastLatencyWarnAt = now;
        console.warn(`[Network] High latency detected: ${latency}ms`);
      }
    }
  }

  getAverageLatency() {
    if (this.latencyHistory.length === 0) {
      return 0;
    }
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  getConnectionQuality() {
    const avgLatency = this.getAverageLatency();

    if (avgLatency < 50) {
      return { text: 'Excellent', color: '#00ff00', class: 'excellent' };
    }
    if (avgLatency < 100) {
      return { text: 'Good', color: '#90ee90', class: 'good' };
    }
    if (avgLatency < 150) {
      return { text: 'Fair', color: '#ffff00', class: 'fair' };
    }
    if (avgLatency < 250) {
      return { text: 'Poor', color: '#ffa500', class: 'poor' };
    }
    return { text: 'Bad', color: '#ff0000', class: 'bad' };
  }

  updateLatencyIndicator() {
    // Update latency display in UI
    const latencyElement = document.getElementById('latency-indicator');
    if (latencyElement) {
      const avgLatency = this.getAverageLatency();
      const quality = this.getConnectionQuality();

      latencyElement.textContent = `${avgLatency}ms`;
      latencyElement.style.color = quality.color;
      latencyElement.className = `latency-indicator ${quality.class}`;
      latencyElement.title = `Connection: ${quality.text} (${avgLatency}ms average)`;
    }
  }

  setupSocketListeners() {
    // Connection event handlers
    this.on('connect', () => {
      const transport = this.socket.io?.engine?.transport?.name ?? 'unknown';
      if (this._initialConnect) {
        this._initialConnect = false;
        console.log(`[Socket.IO] Connected successfully (transport: ${transport})`);
        this._resetReconnectBackoff();
        if (window.toastManager) {
          const quality = this.getConnectionQuality();
          window.toastManager.show(`✅ Connected (${quality.text})`, 'success');
        }
      } else {
        // Manual reconnect path (backoff via _scheduleReconnect → socket.connect())
        console.log(`[Socket.IO] Reconnected (manual backoff path, transport: ${transport})`);
        this.justReconnected = true;
        this._resetReconnectBackoff();
        // Reset PlayerController's lastSentPosition so the first post-reconnect
        // playerMove doesn't compute a huge delta from a stale pre-disconnect
        // reference, which the server anti-cheat would reject → teleport.
        if (window.playerController) {
          const p = window.gameState?.state?.players?.[window.gameState.playerId];
          if (p) {
            window.playerController.lastSentPosition = { x: p.x, y: p.y, angle: p.angle };
            window.playerController.lastNetworkUpdate = performance.now();
          }
        }
        if (window.toastManager) {
          window.toastManager.show('✅ Reconnected to server', 'success');
        }
        // Re-sync: request full authoritative state. Silent no-op if server does not support it.
        this._syncFullState();
      }
    });

    this.on('connect_error', error => {
      console.error('[Socket.IO] Connection error:', error);
      if (window.toastManager) {
        window.toastManager.show('⚠️ Connection error. Retrying...', 'warning');
      }
    });

    this.on('disconnect', reason => {
      console.log('[Socket.IO] Disconnected:', reason);
      if (window.toastManager) {
        window.toastManager.show('🔌 Connexion perdue. Reconnexion en cours...', 'error');
      }
      // Trigger backoff reconnect when socket won't auto-reconnect
      const noAutoReconnect = ['io server disconnect', 'transport close', 'transport error'];
      if (noAutoReconnect.includes(reason)) {
        this._scheduleReconnect();
      }
    });

    this.on('reconnect', attemptNumber => {
      console.log('[Socket.IO] Reconnected after', attemptNumber, 'attempts');
      // Set flag to disable client prediction temporarily
      this.justReconnected = true;
      this._resetReconnectBackoff();
      // Reset lastSentPosition to prevent huge delta → anti-cheat reject on first move
      if (window.playerController) {
        const p = window.gameState?.state?.players?.[window.gameState.playerId];
        if (p) {
          window.playerController.lastSentPosition = { x: p.x, y: p.y, angle: p.angle };
          window.playerController.lastNetworkUpdate = performance.now();
        }
      }
      if (window.toastManager) {
        window.toastManager.show('✅ Reconnected to server', 'success');
      }
      // Re-sync: request full authoritative state. Silent no-op if server does not support it.
      this._syncFullState();
    });

    this.on('reconnect_attempt', attemptNumber => {
      console.log('[Socket.IO] Reconnection attempt', attemptNumber);
      if (window.toastManager) {
        window.toastManager.show(
          `🔄 Reconnexion en cours... (tentative ${attemptNumber})`,
          'warning'
        );
      }
    });

    this.on('reconnect_error', error => {
      console.error('[Socket.IO] Reconnection error:', error);
    });

    this.on('reconnect_failed', () => {
      console.error('[Socket.IO] Reconnection failed');
      if (window.toastManager) {
        window.toastManager.show('❌ Failed to reconnect. Please refresh.', 'error');
      }
      // Fall back to manual exponential backoff
      this._scheduleReconnect();
    });

    // Game event handlers
    this.on('init', data => this.handleInit(data));
    this.on('gameState', state => this.handleGameState(state));
    this.on('gameStateDelta', delta => this.handleGameStateDelta(delta));
    this.on('positionCorrection', data => this.handlePositionCorrection(data));
    this.on('bossSpawned', data => this.handleBossSpawned(data));
    this.on('newWave', data => this.handleNewWave(data));
    this.on('levelUp', data => this.handleLevelUp(data));
    this.on('roomChanged', data => this.handleRoomChanged(data));
    this.on('runCompleted', data => this.handleRunCompleted(data));
    this.on('upgradeSelected', data => this.handleUpgradeSelected(data));
    this.on('shopUpdate', data => this.handleShopUpdate(data));
    this.on('comboUpdate', data => this.handleComboUpdate(data));
    this.on('comboReset', () => this.handleComboReset());
    this.on('sessionTimeout', data => this.handleSessionTimeout(data));
    this.on('sessionReplaced', data => this.handleSessionReplaced(data));
    this.on('mutatorsUpdated', data => this.handleMutatorsUpdated(data));

    // Batched events: server flushes multiple queued events as a single 'batchedEvents' message.
    // Dispatch each {event, data} pair directly to the already-registered socket listeners
    // to avoid triggering outbound emit and to preserve handler semantics.
    this.on('batchedEvents', batch => {
      if (!Array.isArray(batch)) {
        return;
      }
      for (const { event, data } of batch) {
        if (!event) {
          continue;
        }
        const fns = this.socket.listeners(event);
        for (const fn of fns) {
          fn(data);
        }
      }
    });
  }

  handleInit(data) {
    window.gameState.initialize(data);
    if (data.mutators && window.runMutatorsSystem && window.runMutatorsSystem.applyServerMutators) {
      window.runMutatorsSystem.applyServerMutators(data.mutators, {
        effects: data.mutatorEffects,
        nextRotationWave: data.nextMutatorWave,
        wave: window.gameState.state.wave || 1
      });
    }

    // Show notification if session was recovered
    if (data.recovered && window.toastManager) {
      window.toastManager.show(
        '🔄 Session restaurée ! Votre progression a été récupérée.',
        'success'
      );
      console.log('[Session] State successfully recovered');
    }
  }

  handleMutatorsUpdated(data) {
    if (!data || !data.mutators) {
      return;
    }

    if (window.gameState && window.gameState.state) {
      window.gameState.state.mutators = data.mutators;
    }

    if (window.runMutatorsSystem && window.runMutatorsSystem.applyServerMutators) {
      window.runMutatorsSystem.applyServerMutators(data.mutators, data);
    }
  }

  handleGameState(state) {
    // ALWAYS save local player position for client prediction (except right after reconnect)
    let localPlayerState = null;
    if (
      !this.justReconnected &&
      window.gameState.state &&
      window.gameState.state.players &&
      window.gameState.state.players[window.gameState.playerId]
    ) {
      const localPlayer = window.gameState.state.players[window.gameState.playerId];
      localPlayerState = { x: localPlayer.x, y: localPlayer.y, angle: localPlayer.angle };
    }

    // FIX: Update server time offset for latency compensation
    if (state.serverTime) {
      window.gameState.updateServerTime(state.serverTime);
    }

    // Update state with server data
    window.gameState.updateState(state);

    // Re-apply client-side environment systems (biome/weather)
    if (window.biomeSystem && window.biomeSystem.applyToGameState) {
      window.biomeSystem.applyToGameState();
    }

    // Client prediction: restore local position unless server differs significantly
    if (
      localPlayerState &&
      window.gameState.state.players &&
      window.gameState.state.players[window.gameState.playerId]
    ) {
      const serverPlayer = window.gameState.state.players[window.gameState.playerId];
      const dx = localPlayerState.x - serverPlayer.x;
      const dy = localPlayerState.y - serverPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Always trust client prediction on full-state. The previous 500px snap
      // caused visible rollbacks when client/server state diverged cross-session
      // or during wall desyncs. Real anti-cheat violations come via the
      // `positionCorrection` event which still applies corrections.
      if (distance > 500) {
        console.warn(
          '[DESYNC-FULL] ' +
            distance.toFixed(0) +
            'px local=(' +
            localPlayerState.x.toFixed(0) +
            ',' +
            localPlayerState.y.toFixed(0) +
            ') server=(' +
            serverPlayer.x.toFixed(0) +
            ',' +
            serverPlayer.y.toFixed(0) +
            ')'
        );
      }
      window.gameState.state.players[window.gameState.playerId].x = localPlayerState.x;
      window.gameState.state.players[window.gameState.playerId].y = localPlayerState.y;
      window.gameState.state.players[window.gameState.playerId].angle = localPlayerState.angle;
    }

    // Clear reconnection flag after accepting server state
    if (this.justReconnected) {
      console.log('[Socket.IO] Position resynchronized after reconnection');
      this.justReconnected = false;
    }

    if (window.gameUI) {
      window.gameUI.update();
    }
  }

  /**
   * Apply a delta patch for the local player (client-prediction path).
   * Never overwrites x/y/angle — those stay client-predicted.
   * @private
   */
  _applyLocalPlayerPatch(type, id, patch, isNew, localPlayerState) {
    if (isNew) {
      window.gameState.state[type][id] = patch;
    } else {
      Object.assign(window.gameState.state[type][id] || {}, patch);
    }
    // Always restore client-predicted position/angle
    const e = window.gameState.state[type][id];
    e.x = localPlayerState.x;
    e.y = localPlayerState.y;
    e.angle = localPlayerState.angle;
  }

  /**
   * Apply a delta patch for a non-local entity (merge or init).
   * Stamps _serverX/_serverY/_serverTime when position changes (for interpolation).
   * @private
   */
  _applyEntityPatch(type, id, patch, isNew, packetServerTime) {
    if (isNew || !window.gameState.state[type][id]) {
      const entity = Object.assign({}, patch);
      delete entity._new;
      if (entity.x !== undefined) {
        entity._serverX = entity.x;
        entity._serverY = entity.y;
        if (packetServerTime !== undefined) {
          entity._serverTime = packetServerTime;
        }
      }
      window.gameState.state[type][id] = entity;
    } else {
      const entity = window.gameState.state[type][id];
      const hadPosition = patch.x !== undefined;
      Object.assign(entity, patch);
      if (hadPosition) {
        entity._serverX = entity.x;
        entity._serverY = entity.y;
        if (packetServerTime !== undefined) {
          entity._serverTime = packetServerTime;
        }
      }
    }
  }

  handleGameStateDelta(delta) {
    // Track previous health for damage detection (SCREEN EFFECTS)
    let prevHealth = null;
    let prevMaxHealth = null;

    // ALWAYS save local player position for client prediction (except right after reconnect)
    let localPlayerState = null;
    if (
      !this.justReconnected &&
      window.gameState.state &&
      window.gameState.state.players &&
      window.gameState.state.players[window.gameState.playerId]
    ) {
      const localPlayer = window.gameState.state.players[window.gameState.playerId];
      localPlayerState = { x: localPlayer.x, y: localPlayer.y, angle: localPlayer.angle };
      prevHealth = localPlayer.health;
      prevMaxHealth = localPlayer.maxHealth;
    }

    // FIX: Update server time offset for latency compensation
    if (delta.serverTime) {
      window.gameState.updateServerTime(delta.serverTime);
    }

    // Capture serverTime once for the whole delta batch so each entity
    // snapshot gets a consistent authoritative timestamp.
    const packetServerTime = delta.serverTime || undefined;

    // Apply delta updates — for...in avoids Object.entries array allocations
    if (delta.updated) {
      for (const type in delta.updated) {
        if (!window.gameState.state[type]) {
          window.gameState.state[type] = {};
        }
        const entities = delta.updated[type];
        for (const id in entities) {
          const patch = entities[id];
          // Dequantise angle if present (server sends 0-255 byte)
          // Do this before merging so the stored value is always in radians
          if (patch.angle !== undefined) {
            patch.angle = patch.angle * ANGLE_TO_RAD;
          }

          const isNew = patch._new === true;

          // For local player: only update non-position attributes (health, etc.)
          // Position is handled by client prediction
          if (type === 'players' && id === window.gameState.playerId && localPlayerState) {
            this._applyLocalPlayerPatch(type, id, patch, isNew, localPlayerState);
          } else {
            this._applyEntityPatch(type, id, patch, isNew, packetServerTime);
          }
          // Mark entity as seen to prevent orphan cleanup
          window.gameState.markEntitySeen(type, id);
        }
      }
    }

    // Remove deleted entities — for...in avoids Object.entries array allocations
    if (delta.removed) {
      for (const type in delta.removed) {
        if (window.gameState.state[type]) {
          const ids = delta.removed[type];
          for (let i = 0; i < ids.length; i++) {
            delete window.gameState.state[type][ids[i]];
          }
        }
      }
    }

    // Update metadata
    if (delta.meta) {
      if (delta.meta.wave !== undefined) {
        window.gameState.state.wave = delta.meta.wave;
      }
      if (delta.meta.walls !== undefined) {
        window.gameState.state.walls = delta.meta.walls;
      }
      if (delta.meta.currentRoom !== undefined) {
        window.gameState.state.currentRoom = delta.meta.currentRoom;
      }
      if (delta.meta.bossSpawned !== undefined) {
        window.gameState.state.bossSpawned = delta.meta.bossSpawned;
      }
    }

    if (window.biomeSystem && window.biomeSystem.applyToGameState) {
      window.biomeSystem.applyToGameState();
    }

    // Server reconciliation: check if server position differs significantly.
    // If the server echoes lastAckSequence, replay unacknowledged inputs on top
    // of the server position to get a reconciled position (client-side prediction).
    if (
      localPlayerState &&
      delta.updated &&
      delta.updated.players &&
      delta.updated.players[window.gameState.playerId]
    ) {
      const serverPlayer = delta.updated.players[window.gameState.playerId];
      const dx = localPlayerState.x - serverPlayer.x;
      const dy = localPlayerState.y - serverPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Never snap to server on delta — anti-cheat uses positionCorrection event.
      if (distance > 500) {
        console.warn(
          '[DESYNC] distance=' +
            distance.toFixed(0) +
            'px local=(' +
            localPlayerState.x.toFixed(0) +
            ',' +
            localPlayerState.y.toFixed(0) +
            ') server=(' +
            serverPlayer.x.toFixed(0) +
            ',' +
            serverPlayer.y.toFixed(0) +
            ') — ignored, keeping client prediction'
        );
      }
      // All delta cases trust client prediction for the local player.
    }

    // Clear reconnection flag after first delta update
    if (this.justReconnected) {
      console.log('[Socket.IO] Position resynchronized after reconnection (delta)');
      this.justReconnected = false;
    }

    // Detect damage to player and trigger screen flash (SCREEN EFFECTS)
    if (
      prevHealth !== null &&
      prevMaxHealth !== null &&
      window.gameState.state.players &&
      window.gameState.state.players[window.gameState.playerId]
    ) {
      const updatedPlayer = window.gameState.state.players[window.gameState.playerId];
      if (updatedPlayer.health < prevHealth && updatedPlayer.alive) {
        const damageAmount = prevHealth - updatedPlayer.health;
        const damagePercent = damageAmount / prevMaxHealth;
        if (window.screenEffects) {
          window.screenEffects.onPlayerDamage(damagePercent);
        }
      }
      // Stop heartbeat on death
      if (!updatedPlayer.alive && window.advancedAudio) {
        window.advancedAudio.stopLowHealthHeartbeat();
      }
    }

    // Detect boss death for slow motion effect (SCREEN EFFECTS)
    if (delta.removed && delta.removed.zombies && window.screenEffects) {
      // Check if any removed zombie was a boss
      delta.removed.zombies.forEach(_zombieId => {
        // We need to check if it was a boss before removal
        // The server should send a specific event for boss death, but we can also detect it here
        // For now, we'll rely on the bossSpawned meta flag change
      });
    }

    // Detect boss death via bossSpawned flag change
    if (
      delta.meta &&
      delta.meta.bossSpawned === false &&
      window.gameState.state.bossSpawned === true &&
      window.screenEffects
    ) {
      window.screenEffects.onBossDeath();
    }

    if (window.gameUI) {
      window.gameUI.update();
    }
  }

  handlePositionCorrection(data) {
    // Server detected invalid movement and is correcting position
    const local = window.gameState?.state?.players?.[window.gameState.playerId];
    console.warn(
      '[ROLLBACK-CORR] server=(' +
        data.x.toFixed(0) +
        ',' +
        data.y.toFixed(0) +
        ')' +
        (local ? ' local=(' + local.x.toFixed(0) + ',' + local.y.toFixed(0) + ')' : '')
    );

    // Apply correction to player position (this overrides client prediction)
    if (
      window.gameState.state &&
      window.gameState.state.players &&
      window.gameState.state.players[window.gameState.playerId]
    ) {
      const player = window.gameState.state.players[window.gameState.playerId];
      const oldX = player.x;
      const oldY = player.y;

      // Calculate correction distance for logging
      const dx = data.x - oldX;
      const dy = data.y - oldY;
      const correctionDistance = Math.sqrt(dx * dx + dy * dy);

      // Smart interpolation based on correction size and frequency.
      // FIX(tp): raised smooth threshold 30 → 100px. Anti-cheat leaky-bucket
      // rejections under lag spikes typically correct by 40-80px — applying
      // a hard snap in that range was the main source of perceived player TP.
      // True desyncs (>100px) still hard-correct.
      //
      // FIX(oscillation): if multiple corrections arrive within 200ms, hard-snap
      // instead of lerping. Repeated 0.5-lerps compound (0.5^N) and each
      // intermediate position triggers a new server correction → rubber-band loop.
      const now = Date.now();
      const timeSinceLast = now - (this._lastCorrectionTime || 0);
      const isRapidCorrection = timeSinceLast < 200;

      if (isRapidCorrection) {
        this._correctionCount = (this._correctionCount || 0) + 1;
      } else if (timeSinceLast > 500) {
        this._correctionCount = 0;
      }
      this._lastCorrectionTime = now;

      const shouldHardSnap = correctionDistance >= 100 || isRapidCorrection;

      if (shouldHardSnap) {
        // Hard snap: large desync OR rapid consecutive corrections
        player.x = data.x;
        player.y = data.y;
        // Clear any pending lerp correction so it doesn't fight the hard snap.
        delete player._correctionTarget;
        console.log(
          '[Socket.IO] Hard snap correction. Distance:',
          correctionDistance.toFixed(1),
          'px, rapid:',
          isRapidCorrection,
          'count:',
          this._correctionCount
        );
      } else {
        // Smooth lerp correction over ~150ms: store the target so the render
        // loop (GameStateManager.interpolate) can gradually blend toward it
        // without a visible teleport. Falls back to immediate if no render loop.
        player._correctionTarget = { x: data.x, y: data.y, startTime: now, duration: 150 };
        console.log(
          '[Socket.IO] Small correction queued for smooth lerp. Distance:',
          correctionDistance.toFixed(1),
          'px'
        );
      }

      // Reset lastSentPosition to the corrected position so the next
      // _maybeEmitMove does not compute a huge delta from the stale value,
      // which would immediately trigger another server correction.
      const playerController = window.playerController || window.gameState?.playerController;
      if (playerController?.lastSentPosition) {
        playerController.lastSentPosition.x = player.x;
        playerController.lastSentPosition.y = player.y;
      }

      if (window.toastManager && correctionDistance > 50) {
        window.toastManager.show('⚠️ Position corrected', 'warning');
      }
    }
  }

  handleBossSpawned(data) {
    if (window.gameUI) {
      window.gameUI.showBossAnnouncement(data.bossName);
    }
    document.dispatchEvent(new CustomEvent('boss_spawned', { detail: data }));
  }

  handleNewWave(data) {
    if (window.gameUI) {
      window.gameUI.showNewWaveAnnouncement(data.wave, data.zombiesCount);
      // BUGFIX (multi): only auto-open the shop if the local player is alive,
      // not already in a modal (level-up, shop, settings, etc.) and not the
      // dead/spectating state. Avoids unwanted popup interrupting another
      // player's combat or upgrade selection.
      if (this._shouldAutoOpenShop()) {
        setTimeout(() => {
          if (this._shouldAutoOpenShop()) {
            window.gameUI.showShop();
          }
        }, CONSTANTS.ANIMATIONS.SHOP_DELAY);
      }
    }
    if (data.mutators && window.runMutatorsSystem && window.runMutatorsSystem.applyServerMutators) {
      window.runMutatorsSystem.applyServerMutators(data.mutators, data);
    }
    document.dispatchEvent(new CustomEvent('wave_changed', { detail: data }));
  }

  /**
   * Returns true when the shop modal can be opened without disrupting the
   * local player (alive, not dead, no other modal blocking).
   * @private
   */
  _shouldAutoOpenShop() {
    if (!window.gameUI) {
      return false;
    }
    if (window.gameUI.shopOpen || window.gameUI.levelUpOpen || window.gameUI.settingsOpen) {
      return false;
    }
    const localPlayer =
      window.gameState && window.gameState.getPlayer && window.gameState.getPlayer();
    if (!localPlayer || !localPlayer.alive) {
      return false;
    }
    return true;
  }

  handleLevelUp(data) {
    if (window.gameUI) {
      if (data.milestoneBonus) {
        window.gameUI.showMilestoneBonus(data.milestoneBonus, data.newLevel);
        setTimeout(() => {
          if (window.gameUI) {
            window.gameUI.showLevelUpScreen(data.newLevel, data.upgradeChoices);
          }
        }, CONSTANTS.ANIMATIONS.MILESTONE_DELAY);
      } else {
        window.gameUI.showLevelUpScreen(data.newLevel, data.upgradeChoices);
      }
    }
  }

  handleRoomChanged(data) {
    // Apply new room walls immediately so client collision doesn't use stale
    // walls from the previous room (caused walk-through + teleport-back bugs).
    if (data.walls && window.gameState && window.gameState.state) {
      window.gameState.state.walls = data.walls;
    }
    if (window.gameUI) {
      window.gameUI.showRoomAnnouncement(data.roomIndex + 1, data.totalRooms);
    }
    document.dispatchEvent(new CustomEvent('room_changed', { detail: data }));
  }

  handleRunCompleted(data) {
    if (window.gameUI) {
      window.gameUI.showRunCompleted(data.gold, data.level);
    }
  }

  handleUpgradeSelected(_data) {
    // Upgrade successfully selected
  }

  handleShopUpdate(data) {
    // Release the in-flight guard regardless of success/failure
    if (window.gameUI) {
      window.gameUI._buyPending = false;
    }

    if (data.success) {
      // Show success message
      if (window.toastManager) {
        window.toastManager.show('✅ Achat réussi !', 'success', 2000);
      }

      // Refresh shop if open
      if (window.gameUI && window.gameUI.shopOpen) {
        window.gameUI.populateShop();
      }
    } else {
      // Show error message
      if (window.toastManager) {
        const message = data.message || 'Achat impossible';
        window.toastManager.show(`❌ ${message}`, 'error', 2500);
      }
      console.warn('[Shop] Purchase failed:', data.message);
    }
  }

  handleComboUpdate(data) {
    if (window.comboSystem) {
      window.comboSystem.updateCombo(data);
    }
  }

  handleComboReset() {
    if (window.comboSystem) {
      window.comboSystem.resetCombo();
    }
  }

  handleSessionReplaced(data) {
    console.warn('[Socket.IO] Session replaced by another tab:', data.reason);
    if (window.toastManager) {
      window.toastManager.show(
        '⚠️ Connexion fermée : un autre onglet a pris le relais.',
        'error',
        4000
      );
    }
  }

  handleSessionTimeout(data) {
    console.log('[Socket.IO] Session timeout:', data.reason);

    // Show error message to user
    if (window.toastManager) {
      window.toastManager.show(
        '⏱️ Session expirée: ' + (data.reason || 'Inactivité détectée'),
        'error'
      );
    }

    // Show alert with option to reload
    setTimeout(() => {
      if (confirm('Votre session a expiré. Voulez-vous recharger la page ?')) {
        window.location.reload();
      }
    }, 500);
  }

  connectWithAuth(auth) {
    return new Promise((resolve, reject) => {
      if (auth && typeof auth === 'object') {
        this.socket.auth = auth;
      }

      if (this.socket.connected) {
        resolve();
        return;
      }

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = error => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      this.socket.connect();
    });
  }

  // Send events to server
  setNickname(nickname) {
    this.socket.emit('setNickname', { nickname });
  }

  endSpawnProtection() {
    this.socket.emit('endSpawnProtection');
  }

  playerMove(x, y, angle) {
    // Bypass microtask queue for movement — emit synchronously to minimize
    // perceived input lag. Shop/progression events keep using _queueEmit.
    this.socket.emit('playerMove', { x, y, angle });
  }

  /**
   * Emit a batch of compressed moves in a single WS frame.
   * Each item uses delta encoding {dx, dy, angle} relative to the position
   * before that move was applied (server reconstructs absolute coords).
   * Reduces frame overhead from N small frames to 1 larger frame.
   * @param {Array<{dx: number, dy: number, angle: number}>} batch
   */
  playerMoveBatch(batch) {
    if (!batch || batch.length === 0) {
      return;
    }
    this.socket.emit('playerMoveBatch', batch);
  }

  shoot(angle) {
    this._queueEmit('shoot', { angle });
  }

  respawn() {
    this.socket.emit('respawn');
  }

  selectUpgrade(upgradeId) {
    this.socket.emit('selectUpgrade', { upgradeId });
  }

  buyItem(itemId, category) {
    this.socket.emit('buyItem', { itemId, category });
  }

  shopOpened() {
    this.socket.emit('shopOpened');
  }

  shopClosed() {
    this.socket.emit('shopClosed');
  }
}

// Export to window
window.NetworkManager = NetworkManager;
