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
  constructor(socket, deps = {}) {
    this.socket = socket;
    this.justReconnected = false; // Flag to track reconnection state
    this._initialConnect = true; // True until the first successful connect
    this.listeners = []; // Track all listeners for cleanup

    // Dependency injection — fallback to window.* for backward compat
    const DEP_KEYS = [
      'gameState', 'gameUI', 'playerController', 'comboSystem',
      'screenEffects', 'biomeSystem', 'runMutatorsSystem',
      'advancedAudio', 'toastManager', 'timerManager'
    ];
    this._fallbackWarned = false;
    this._deps = {};
    for (const key of DEP_KEYS) {
      if (deps[key] !== undefined) {
        this._deps[key] = deps[key];
      } else {
        Object.defineProperty(this._deps, key, {
          get: () => {
            if (!this._fallbackWarned) {
              this._fallbackWarned = true;
              console.warn('[NetworkManager] Using window.* fallback for deps. Pass deps to constructor.');
            }
            return window[key];
          },
          enumerable: true, configurable: true
        });
      }
    }

    // Latency monitoring
    this.latency = 0; // Current latency in ms
    this.lastPingTime = 0;
    // Ring buffer for latency history — zero-alloc, no shift()
    this._latencyBuf = new Float32Array(10);
    this._latencyBufIdx = 0;
    this._latencyBufCount = 0;
    this._lastLatencyWarnAt = 0; // Throttle high-latency log (once per 5 s)

    // Outbound emit batch queue (flushed via queueMicrotask within same rAF tick)
    this._emitQueue = [];
    this._emitFlushPending = false;

    // Exponential backoff reconnect state
    this._reconnectAttempts = 0;
    this._reconnectBackoffMs = 1000; // initial delay
    this._reconnectMaxBackoffMs = 30000;
    this._reconnectTimer = null;

    // Input buffer: playerMove events queued while disconnected, flushed on reconnect.
    // Capped at 60 entries (~1s at 60fps) to avoid stale burst replay after long outage.
    this._moveBuffer = [];
    this._moveBufferMax = 60;

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
    this._showReconnectOverlay(this._reconnectAttempts, Math.round(delay / 1000));

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
    this._hideReconnectOverlay();
  }

  /** Display the reconnection banner (idempotent). Built with DOM APIs only. */
  _showReconnectOverlay(attempt, seconds) {
    const MAX_ATTEMPTS = 10;
    let el = document.getElementById('reconnect-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'reconnect-overlay';
      el.className = 'reconnect-overlay';

      const spinner = document.createElement('div');
      spinner.className = 'reconnect-spinner';

      const msg = document.createElement('div');
      msg.className = 'reconnect-message';
      msg.textContent = 'Connexion perdue.';

      const detail = document.createElement('div');
      detail.className = 'reconnect-detail';
      detail.id = 'reconnect-detail';

      const attemptEl = document.createElement('div');
      attemptEl.className = 'reconnect-attempt';
      attemptEl.id = 'reconnect-attempt';

      const actions = document.createElement('div');
      actions.className = 'reconnect-actions';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'reconnect-btn reconnect-btn--retry';
      retryBtn.textContent = 'Retry now';
      retryBtn.addEventListener('click', () => {
        this._clearCountdownTimer();
        if (this._reconnectTimer) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
        }
        if (!this.socket.connected) {
          this.socket.connect();
        }
      });

      const quitBtn = document.createElement('button');
      quitBtn.className = 'reconnect-btn reconnect-btn--quit';
      quitBtn.textContent = 'Quit to menu';
      quitBtn.addEventListener('click', () => {
        this._clearCountdownTimer();
        this._hideReconnectOverlay();
        this._reconnectAttempts = Infinity;
        if (this._reconnectTimer) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
        }
        this.socket.io.opts.reconnection = false;
        document.dispatchEvent(new CustomEvent('reconnect_abandoned'));
      });

      actions.appendChild(retryBtn);
      actions.appendChild(quitBtn);

      el.appendChild(spinner);
      el.appendChild(msg);
      el.appendChild(detail);
      el.appendChild(attemptEl);
      el.appendChild(actions);
      document.body.appendChild(el);
    }

    const detail = document.getElementById('reconnect-detail');
    const attemptEl = document.getElementById('reconnect-attempt');
    if (attemptEl) {
      attemptEl.textContent = `Attempt ${attempt}/${MAX_ATTEMPTS}`;
    }

    this._clearCountdownTimer();
    this._startCountdown(detail, seconds);
    el.style.display = 'flex';
  }

  /** Start a live countdown in the detail element. @private */
  _startCountdown(detailEl, seconds) {
    let remaining = seconds;
    const update = () => {
      if (detailEl) {
        detailEl.textContent = `Reconnecting in ${remaining}s…`;
      }
    };
    update();
    if (remaining > 0) {
      this._countdownTimer = setInterval(() => {
        remaining--;
        update();
        if (remaining <= 0) {
          this._clearCountdownTimer();
        }
      }, 1000);
    }
  }

  /** Clear the countdown interval. @private */
  _clearCountdownTimer() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  _hideReconnectOverlay() {
    this._clearCountdownTimer();
    const el = document.getElementById('reconnect-overlay');
    if (el) {
      el.style.display = 'none';
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
    if (this.pingIntervalId && this._deps.timerManager) {
      this._deps.timerManager.clearInterval(this.pingIntervalId);
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
        // Report last-measured latency alongside the ping so the server can
        // maintain per-socket latency for adaptive broadcast throttling.
        this.socket.emit('app:ping', start, this.latency || 0, _ack => {
          const latency = Math.round(performance.now() - start);
          this.updateLatency(latency);
        });
      }
    };

    const timerMgr = this._deps.timerManager;
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

    // Add to ring buffer (zero-alloc)
    this._latencyBuf[this._latencyBufIdx] = latency;
    this._latencyBufIdx = (this._latencyBufIdx + 1) % this._latencyBuf.length;
    if (this._latencyBufCount < this._latencyBuf.length) {
this._latencyBufCount++;
}

    // Update UI indicator if available
    this.updateLatencyIndicator();

    // Update GameStateManager with latency for adaptive interpolation
    if (this._deps.gameState && this._deps.gameState.updateNetworkLatency) {
      this._deps.gameState.updateNetworkLatency(latency);
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
    if (this._latencyBufCount === 0) {
      return 0;
    }
    let sum = 0;
    for (let i = 0; i < this._latencyBufCount; i++) {
sum += this._latencyBuf[i];
}
    return Math.round(sum / this._latencyBufCount);
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
        if (this._deps.toastManager) {
          const quality = this.getConnectionQuality();
          this._deps.toastManager.show({ message: `✅ Connected (${quality.text})`, type: 'success' });
        }
      } else {
        // Manual reconnect path (backoff via _scheduleReconnect → socket.connect())
        console.log(`[Socket.IO] Reconnected (manual backoff path, transport: ${transport})`);
        this.justReconnected = true;
        this._resetReconnectBackoff();
        // Reset PlayerController's lastSentPosition so the first post-reconnect
        // playerMove doesn't compute a huge delta from a stale pre-disconnect
        // reference, which the server anti-cheat would reject → teleport.
        if (this._deps.playerController) {
          const p = this._deps.gameState?.state?.players?.[this._deps.gameState.playerId];
          if (p) {
            this._deps.playerController.lastSentPosition = { x: p.x, y: p.y, angle: p.angle };
            this._deps.playerController.lastNetworkUpdate = performance.now();
          }
        }
        if (this._deps.toastManager) {
          this._deps.toastManager.show({ message: '✅ Reconnected to server', type: 'success' });
        }
        // Re-sync: request full authoritative state. Silent no-op if server does not support it.
        this._syncFullState();
        this._flushMoveBuffer();
      }
    });

    this.on('connect_error', error => {
      console.error('[Socket.IO] Connection error:', error);
      if (this._deps.toastManager) {
        this._deps.toastManager.show({ message: '⚠️ Connection error. Retrying...', type: 'warning' });
      }
    });

    this.on('disconnect', reason => {
      console.log('[Socket.IO] Disconnected:', reason);
      if (this._deps.toastManager) {
        this._deps.toastManager.show({ message: '🔌 Connexion perdue. Reconnexion en cours...', type: 'error' });
      }
      // Invalidate the server-time offset: clocks may have drifted while the
      // socket was down (long suspends, OS clock change). The next server
      // packet after reconnect will re-prime via updateServerTime().
      if (this._deps.gameState && typeof this._deps.gameState === 'object') {
        this._deps.gameState._serverTimeSynced = false;
        this._deps.gameState.serverTimeOffset = 0;
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
      if (this._deps.playerController) {
        const p = this._deps.gameState?.state?.players?.[this._deps.gameState.playerId];
        if (p) {
          this._deps.playerController.lastSentPosition = { x: p.x, y: p.y, angle: p.angle };
          this._deps.playerController.lastNetworkUpdate = performance.now();
        }
      }
      if (this._deps.toastManager) {
        this._deps.toastManager.show({ message: '✅ Reconnected to server', type: 'success' });
      }
      // Re-sync: request full authoritative state. Silent no-op if server does not support it.
      this._syncFullState();
      this._flushMoveBuffer();
    });

    this.on('reconnect_attempt', attemptNumber => {
      console.log('[Socket.IO] Reconnection attempt', attemptNumber);
      if (this._deps.toastManager) {
        this._deps.toastManager.show({ message: `🔄 Reconnexion en cours... (tentative ${attemptNumber})`, type: 'warning' });
      }
    });

    this.on('reconnect_error', error => {
      console.error('[Socket.IO] Reconnection error:', error);
    });

    this.on('reconnect_failed', () => {
      console.error('[Socket.IO] Reconnection failed');
      if (this._deps.toastManager) {
        this._deps.toastManager.show({ message: '❌ Failed to reconnect. Please refresh.', type: 'error' });
      }
      // Fall back to manual exponential backoff
      this._scheduleReconnect();
    });

    // Game event handlers
    this.on('init', data => this.handleInit(data));
    this.on('gameState', state => this.handleGameState(state));
    this.on('gameStateDelta', delta => this.handleGameStateDelta(delta));
    this.on('positionCorrection', data => this.handlePositionCorrection(data));
    this.on('moveAck', data => {
      if (this._deps.playerController && typeof this._deps.playerController.reconcileWithServer === 'function') {
        this._deps.playerController.reconcileWithServer(data);
      }
    });
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
    this._deps.gameState.initialize(data);
    if (data.mutators && this._deps.runMutatorsSystem && this._deps.runMutatorsSystem.applyServerMutators) {
      this._deps.runMutatorsSystem.applyServerMutators(data.mutators, {
        effects: data.mutatorEffects,
        nextRotationWave: data.nextMutatorWave,
        wave: this._deps.gameState.state.wave || 1
      });
    }

    // Show notification if session was recovered
    if (data.recovered && this._deps.toastManager) {
      this._deps.toastManager.show({ message: '🔄 Session restaurée ! Votre progression a été récupérée.', type: 'success' });
      console.log('[Session] State successfully recovered');
    }
  }

  handleMutatorsUpdated(data) {
    if (!data || !data.mutators) {
      return;
    }

    if (this._deps.gameState && this._deps.gameState.state) {
      this._deps.gameState.state.mutators = data.mutators;
    }

    if (this._deps.runMutatorsSystem && this._deps.runMutatorsSystem.applyServerMutators) {
      this._deps.runMutatorsSystem.applyServerMutators(data.mutators, data);
    }
  }

  handleGameState(state) {
    // ALWAYS save local player position for client prediction (except right after reconnect)
    let localPlayerState = null;
    if (
      !this.justReconnected &&
      this._deps.gameState.state &&
      this._deps.gameState.state.players &&
      this._deps.gameState.state.players[this._deps.gameState.playerId]
    ) {
      const localPlayer = this._deps.gameState.state.players[this._deps.gameState.playerId];
      localPlayerState = { x: localPlayer.x, y: localPlayer.y, angle: localPlayer.angle };
    }

    // FIX: Update server time offset for latency compensation
    if (state.serverTime) {
      this._deps.gameState.updateServerTime(state.serverTime);
    }

    // Update state with server data (passe serverTime pour ancrage interp)
    this._deps.gameState.updateState(state, state.serverTime);

    // Re-apply client-side environment systems (biome/weather)
    if (this._deps.biomeSystem && this._deps.biomeSystem.applyToGameState) {
      this._deps.biomeSystem.applyToGameState();
    }

    // Client prediction: restore local position unless server differs significantly
    if (
      localPlayerState &&
      this._deps.gameState.state.players &&
      this._deps.gameState.state.players[this._deps.gameState.playerId]
    ) {
      const serverPlayer = this._deps.gameState.state.players[this._deps.gameState.playerId];
      const dx = localPlayerState.x - serverPlayer.x;
      const dy = localPlayerState.y - serverPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Trust client prediction for moderate drift (<200px) to avoid visible
      // rubber-band. Only hard-snap on catastrophic desync (map bounds, wall
      // phasing, reconnect). The server broadcasts position every tick so
      // smaller drifts auto-correct through normal delta interpolation.
      const PREDICTION_TRUST_PX = 200;
      const p = this._deps.gameState.state.players[this._deps.gameState.playerId];
      if (distance > PREDICTION_TRUST_PX) {
        p.x = serverPlayer.x;
        p.y = serverPlayer.y;
        p.angle = serverPlayer.angle;
      } else {
        p.x = localPlayerState.x;
        p.y = localPlayerState.y;
        p.angle = localPlayerState.angle;
      }
    }

    // Clear reconnection flag after accepting server state
    if (this.justReconnected) {
      console.log('[Socket.IO] Position resynchronized after reconnection');
      this.justReconnected = false;
    }

    if (this._deps.gameUI) {
      this._deps.gameUI.update();
    }
  }

  /**
   * Apply a delta patch for the local player (client-prediction path).
   * Never overwrites x/y/angle — those stay client-predicted.
   * @private
   */
  _applyLocalPlayerPatch(type, id, patch, isNew, localPlayerState) {
    if (isNew) {
      this._deps.gameState.state[type][id] = patch;
    } else {
      Object.assign(this._deps.gameState.state[type][id] || {}, patch);
    }
    // Keep client prediction when drift is moderate, hard-snap only on
    // catastrophic desync. Trust the client for smooth playing experience.
    const e = this._deps.gameState.state[type][id];
    const sx = typeof patch.x === 'number' ? patch.x : e.x;
    const sy = typeof patch.y === 'number' ? patch.y : e.y;
    const drift = Math.hypot(localPlayerState.x - sx, localPlayerState.y - sy);
    if (drift > 200) {
      e.x = sx;
      e.y = sy;
      e.angle = typeof patch.angle === 'number' ? patch.angle : e.angle;
    } else {
      e.x = localPlayerState.x;
      e.y = localPlayerState.y;
      e.angle = localPlayerState.angle;
    }
  }

  /**
   * Apply a delta patch for a non-local entity (merge or init).
   * Stamps _serverX/_serverY/_serverTime when position changes (for interpolation).
   * @private
   */
  _applyEntityPatch(type, id, patch, isNew, packetServerTime) {
    if (isNew || !this._deps.gameState.state[type][id]) {
      const entity = Object.assign({}, patch);
      delete entity._new;
      if (entity.x !== undefined) {
        entity._serverX = entity.x;
        entity._serverY = entity.y;
        if (packetServerTime !== undefined) {
          entity._serverTime = packetServerTime;
        }
      }
      this._deps.gameState.state[type][id] = entity;
    } else {
      const entity = this._deps.gameState.state[type][id];
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

  /**
   * Capture local player pre-delta snapshot for client prediction + damage detect.
   * Returns null when there's no local player yet or right after a reconnect
   * (position must come from server in that case).
   * @returns {{localPlayerState: ?{x,y,angle}, prevHealth: ?number, prevMaxHealth: ?number}}
   */
  _captureLocalPlayerSnapshot() {
    const snapshot = { localPlayerState: null, prevHealth: null, prevMaxHealth: null };
    if (
      this.justReconnected ||
      !this._deps.gameState.state ||
      !this._deps.gameState.state.players ||
      !this._deps.gameState.state.players[this._deps.gameState.playerId]
    ) {
      return snapshot;
    }
    const localPlayer = this._deps.gameState.state.players[this._deps.gameState.playerId];
    snapshot.localPlayerState = { x: localPlayer.x, y: localPlayer.y, angle: localPlayer.angle };
    snapshot.prevHealth = localPlayer.health;
    snapshot.prevMaxHealth = localPlayer.maxHealth;
    snapshot.prevKills = localPlayer.zombiesKilled || localPlayer.kills || 0;
    snapshot.prevGold = localPlayer.gold || 0;
    snapshot.prevAlive = localPlayer.alive !== false;
    return snapshot;
  }

  /**
   * Apply all updated-entity patches from the delta, respecting the local-player
   * prediction carve-out and dequantising angles.
   */
  _applyDeltaUpdates(updatedByType, localPlayerState, packetServerTime) {
    if (!updatedByType) {
      return;
    }
    for (const type in updatedByType) {
      if (!this._deps.gameState.state[type]) {
        this._deps.gameState.state[type] = {};
      }
      const entities = updatedByType[type];
      for (const id in entities) {
        const patch = entities[id];
        // Dequantise angle if present (server sends 0-255 byte)
        // Do this before merging so the stored value is always in radians
        if (patch.angle !== undefined) {
          patch.angle = patch.angle * ANGLE_TO_RAD;
        }
        const isNew = patch._new === true;
        if (type === 'players' && id === this._deps.gameState.playerId && localPlayerState) {
          this._applyLocalPlayerPatch(type, id, patch, isNew, localPlayerState);
        } else {
          this._applyEntityPatch(type, id, patch, isNew, packetServerTime);
        }
        this._deps.gameState.markEntitySeen(type, id);
      }
    }
  }

  _applyDeltaRemovals(removedByType) {
    if (!removedByType) {
      return;
    }
    for (const type in removedByType) {
      if (!this._deps.gameState.state[type]) {
        continue;
      }
      const ids = removedByType[type];
      for (let i = 0; i < ids.length; i++) {
        delete this._deps.gameState.state[type][ids[i]];
      }
    }
  }

  _applyDeltaMetadata(meta) {
    if (!meta) {
      return;
    }
    if (meta.wave !== undefined) {
      this._deps.gameState.state.wave = meta.wave;
    }
    if (meta.walls !== undefined) {
      this._deps.gameState.state.walls = meta.walls;
    }
    if (meta.currentRoom !== undefined) {
      this._deps.gameState.state.currentRoom = meta.currentRoom;
    }
    if (meta.bossSpawned !== undefined) {
      this._deps.gameState.state.bossSpawned = meta.bossSpawned;
    }
  }

  /**
   * Delta path: snap to server position when predicted drift > 50px.
   * Matches handleGameState full-state policy.
   */
  _checkLocalPlayerDesync(delta, localPlayerState) {
    if (
      !localPlayerState ||
      !delta.updated ||
      !delta.updated.players ||
      !delta.updated.players[this._deps.gameState.playerId]
    ) {
      return;
    }
    const serverPatch = delta.updated.players[this._deps.gameState.playerId];
    if (serverPatch.x === undefined || serverPatch.y === undefined) {
return;
}
    const dx = localPlayerState.x - serverPatch.x;
    const dy = localPlayerState.y - serverPatch.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 50) {
      const p = this._deps.gameState.state.players?.[this._deps.gameState.playerId];
      if (p) {
        p.x = serverPatch.x;
        p.y = serverPatch.y;
        if (typeof serverPatch.angle === 'number') {
p.angle = serverPatch.angle;
}
      }
    }
  }

  /**
   * Emit screen-flash on damage and stop heartbeat on death.
   */
  _detectLocalPlayerDamage(prevHealth, prevMaxHealth) {
    if (
      prevHealth === null ||
      prevMaxHealth === null ||
      !this._deps.gameState.state.players ||
      !this._deps.gameState.state.players[this._deps.gameState.playerId]
    ) {
      return;
    }
    const updatedPlayer = this._deps.gameState.state.players[this._deps.gameState.playerId];
    if (updatedPlayer.health < prevHealth && updatedPlayer.alive && this._deps.screenEffects) {
      const damageAmount = prevHealth - updatedPlayer.health;
      this._deps.screenEffects.onPlayerDamage(damageAmount / prevMaxHealth);
    }
    if (!updatedPlayer.alive && this._deps.advancedAudio) {
      this._deps.advancedAudio.stopLowHealthHeartbeat();
    }
  }

  _detectSessionAchievementEvents(context) {
    const { prevKills, prevGold, prevAlive } = context;
    if (prevKills === undefined || !this._deps.gameState.state.players) {
      return;
    }
    const player = this._deps.gameState.state.players[this._deps.gameState.playerId];
    if (!player) {
      return;
    }
    const currKills = player.zombiesKilled || player.kills || 0;
    const currGold = player.gold || 0;
    const currAlive = player.alive !== false;
    if (currKills > prevKills) {
      document.dispatchEvent(new CustomEvent('session_kill', { detail: { kills: currKills, delta: currKills - prevKills } }));
    }
    if (!currAlive && prevAlive) {
      document.dispatchEvent(new CustomEvent('session_death'));
    }
    if (currGold > prevGold) {
      document.dispatchEvent(new CustomEvent('session_gold', { detail: { gold: currGold } }));
    }
  }

  _detectBossDeath(delta) {
    if (!this._deps.screenEffects) {
      return;
    }
    if (
      delta.meta &&
      delta.meta.bossSpawned === false &&
      this._deps.gameState.state.bossSpawned === true
    ) {
      this._deps.screenEffects.onBossDeath();
    }
  }

  /**
   * Snapshot pre-delta context: local player state + server time anchor.
   * @param {object} delta
   * @returns {{localPlayerState, prevHealth, prevMaxHealth, packetServerTime}}
   */
  _prepareDeltaContext(delta) {
    if (delta.serverTime) {
      this._deps.gameState.updateServerTime(delta.serverTime);
    }
    const { localPlayerState, prevHealth, prevMaxHealth, prevKills, prevGold, prevAlive } = this._captureLocalPlayerSnapshot();
    const packetServerTime = delta.serverTime || undefined;
    return { localPlayerState, prevHealth, prevMaxHealth, prevKills, prevGold, prevAlive, packetServerTime };
  }

  /**
   * Apply all entity updates, removals, and metadata from the delta.
   * @param {object} delta
   * @param {{localPlayerState, packetServerTime}} context
   */
  _processDeltaEntities(delta, context) {
    const { localPlayerState, packetServerTime } = context;
    this._applyDeltaUpdates(delta.updated, localPlayerState, packetServerTime);
    this._applyDeltaRemovals(delta.removed);
    this._applyDeltaMetadata(delta.meta);
  }

  /**
   * React to post-delta events: biome, desync correction, damage, boss death, UI.
   * @param {object} delta
   * @param {{localPlayerState, prevHealth, prevMaxHealth}} context
   */
  _handlePostDeltaEvents(delta, context) {
    const { localPlayerState, prevHealth, prevMaxHealth } = context;

    if (this._deps.biomeSystem && this._deps.biomeSystem.applyToGameState) {
      this._deps.biomeSystem.applyToGameState();
    }

    this._checkLocalPlayerDesync(delta, localPlayerState);

    if (this.justReconnected) {
      console.log('[Socket.IO] Position resynchronized after reconnection (delta)');
      this.justReconnected = false;
    }

    this._detectLocalPlayerDamage(prevHealth, prevMaxHealth);
    this._detectSessionAchievementEvents(context);
    this._detectBossDeath(delta);

    if (this._deps.gameUI) {
      this._deps.gameUI.update();
    }
  }

  handleGameStateDelta(delta) {
    // Track last delta payload size for debug overlay
    try {
      this.lastDeltaSize = JSON.stringify(delta).length;
    } catch (_) { this.lastDeltaSize = 0; }
    const context = this._prepareDeltaContext(delta);
    this._processDeltaEntities(delta, context);
    this._handlePostDeltaEvents(delta, context);
  }

  handlePositionCorrection(data) {
    // Anti-cheat is off → server only sends positionCorrection for stuns /
    // wall slides. Keep the handler but silence the noisy logs.

    // Apply correction to player position (this overrides client prediction)
    if (
      this._deps.gameState.state &&
      this._deps.gameState.state.players &&
      this._deps.gameState.state.players[this._deps.gameState.playerId]
    ) {
      const player = this._deps.gameState.state.players[this._deps.gameState.playerId];
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

      // Small corrections lerp smoothly (no visible teleport). Large ones
      // still snap so the client doesn't drift into walls / through map bounds.
      if (correctionDistance >= 150) {
        player.x = data.x;
        player.y = data.y;
        delete player._correctionTarget;
      } else if (correctionDistance > 2) {
        player._correctionTarget = { x: data.x, y: data.y, startTime: now, duration: 200 };
      }

      // Reset lastSentPosition to the corrected position so the next
      // _maybeEmitMove does not compute a huge delta from the stale value,
      // which would immediately trigger another server correction.
      const playerController = this._deps.playerController || this._deps.gameState?.playerController;
      if (playerController?.lastSentPosition) {
        playerController.lastSentPosition.x = player.x;
        playerController.lastSentPosition.y = player.y;
      }

    }
  }

  handleBossSpawned(data) {
    if (this._deps.gameUI) {
      this._deps.gameUI.showBossAnnouncement(data.bossName);
    }
    document.dispatchEvent(new CustomEvent('boss_spawned', { detail: data }));
  }

  handleNewWave(data) {
    if (this._deps.gameUI) {
      this._deps.gameUI.showNewWaveAnnouncement(data.wave, data.zombiesCount);
      // BUGFIX (multi): only auto-open the shop if the local player is alive,
      // not already in a modal (level-up, shop, settings, etc.) and not the
      // dead/spectating state. Avoids unwanted popup interrupting another
      // player's combat or upgrade selection.
      if (this._shouldAutoOpenShop()) {
        setTimeout(() => {
          if (this._shouldAutoOpenShop()) {
            this._deps.gameUI.showShop();
          }
        }, CONSTANTS.ANIMATIONS.SHOP_DELAY);
      }
    }
    if (data.mutators && this._deps.runMutatorsSystem && this._deps.runMutatorsSystem.applyServerMutators) {
      this._deps.runMutatorsSystem.applyServerMutators(data.mutators, data);
    }
    document.dispatchEvent(new CustomEvent('wave_changed', { detail: data }));
  }

  /**
   * Returns true when the shop modal can be opened without disrupting the
   * local player (alive, not dead, no other modal blocking).
   * @private
   */
  _shouldAutoOpenShop() {
    if (!this._deps.gameUI) {
      return false;
    }
    if (this._deps.gameUI.shopOpen || this._deps.gameUI.levelUpOpen || this._deps.gameUI.settingsOpen) {
      return false;
    }
    const localPlayer =
      this._deps.gameState && this._deps.gameState.getPlayer && this._deps.gameState.getPlayer();
    if (!localPlayer || !localPlayer.alive) {
      return false;
    }
    return true;
  }

  handleLevelUp(data) {
    if (this._deps.gameUI) {
      if (data.milestoneBonus) {
        this._deps.gameUI.showMilestoneBonus(data.milestoneBonus, data.newLevel);
        setTimeout(() => {
          if (this._deps.gameUI) {
            this._deps.gameUI.showLevelUpScreen(data.newLevel, data.upgradeChoices);
          }
        }, CONSTANTS.ANIMATIONS.MILESTONE_DELAY);
      } else {
        this._deps.gameUI.showLevelUpScreen(data.newLevel, data.upgradeChoices);
      }
    }
  }

  handleRoomChanged(data) {
    // Apply new room walls immediately so client collision doesn't use stale
    // walls from the previous room (caused walk-through + teleport-back bugs).
    if (data.walls && this._deps.gameState && this._deps.gameState.state) {
      this._deps.gameState.state.walls = data.walls;
    }
    if (this._deps.gameUI) {
      this._deps.gameUI.showRoomAnnouncement(data.roomIndex + 1, data.totalRooms);
    }
    document.dispatchEvent(new CustomEvent('room_changed', { detail: data }));
  }

  handleRunCompleted(data) {
    if (this._deps.gameUI) {
      this._deps.gameUI.showRunCompleted(data.gold, data.level);
    }
  }

  handleUpgradeSelected(_data) {
    // Upgrade successfully selected
  }

  handleShopUpdate(data) {
    // Release the in-flight guard regardless of success/failure
    if (this._deps.gameUI) {
      this._deps.gameUI._buyPending = false;
    }

    if (data.success) {
      // Show success message
      if (this._deps.toastManager) {
        this._deps.toastManager.show({ message: '✅ Achat réussi !', type: 'success', duration: 2000 });
      }

      // Refresh shop if open, then flash bought item
      if (this._deps.gameUI && this._deps.gameUI.shopOpen) {
        if (data.itemId) this._deps.gameUI._lastBoughtItem = data.itemId;
        this._deps.gameUI.populateShop();
      }
    } else {
      // Show error message
      if (this._deps.toastManager) {
        const message = data.message || 'Achat impossible';
        this._deps.toastManager.show({ message: `❌ ${message}`, type: 'error', duration: 2500 });
      }
      console.warn('[Shop] Purchase failed:', data.message);
    }
  }

  handleComboUpdate(data) {
    if (this._deps.comboSystem) {
      this._deps.comboSystem.updateCombo(data);
    }
  }

  handleComboReset() {
    if (this._deps.comboSystem) {
      this._deps.comboSystem.resetCombo();
    }
  }

  handleSessionReplaced(data) {
    console.warn('[Socket.IO] Session replaced by another tab:', data.reason);
    // Disable auto-reconnect: this tab was legitimately evicted.
    // Reconnecting would re-eject the active tab, creating an infinite loop.
    this._reconnectAttempts = Infinity;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.socket.io.opts.reconnection = false;
    if (this._deps.toastManager) {
      this._deps.toastManager.show({ message: '⚠️ Connexion fermée : un autre onglet a pris le relais.', type: 'error', duration: 4000 });
    }
  }

  handleSessionTimeout(data) {
    console.log('[Socket.IO] Session timeout:', data.reason);

    // Show error message to user
    if (this._deps.toastManager) {
      this._deps.toastManager.show({
        message: '⏱️ Session expirée: ' + (data.reason || 'Inactivité détectée'),
        type: 'error'
      });
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

  /**
   * Emit a single absolute player move to the server.
   * If disconnected, buffers the move (capped at _moveBufferMax) so it can be
   * flushed on reconnect instead of being silently dropped.
   * @param {{x:number,y:number,angle:number,seq:number}} move
   */
  playerMove(move) {
    if (!move) {
      return;
    }
    if (!this.socket.connected) {
      // Keep only the most-recent moves (drop oldest) to avoid stale burst on reconnect.
      if (this._moveBuffer.length >= this._moveBufferMax) {
        this._moveBuffer.shift();
      }
      this._moveBuffer.push(move);
      return;
    }
    this.socket.emit('playerMove', move);
  }

  /** Flush buffered moves after reconnect. Emits only the last position (dedup). @private */
  _flushMoveBuffer() {
    if (this._moveBuffer.length === 0) {
      return;
    }
    // Only the final position matters for state sync; intermediate moves are stale.
    const last = this._moveBuffer[this._moveBuffer.length - 1];
    this._moveBuffer = [];
    if (this.socket.connected) {
      this.socket.emit('playerMove', last);
    }
  }

  /**
   * Legacy batch API kept for backward compat with older call-sites; now
   * fans out individual playerMove events.
   * @param {Array<{dx:number,dy:number,angle:number,seq:number}>} batch
   */
  playerMoveBatch(batch) {
    if (!batch || batch.length === 0) {
return;
}
    for (const item of batch) {
      this.socket.emit('playerMove', item);
    }
  }

  shoot(angle, x, y) {
    this._queueEmit('shoot', { angle, x, y });
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
