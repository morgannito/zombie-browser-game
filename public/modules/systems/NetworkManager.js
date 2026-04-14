/**
 * NETWORK MANAGER
 * Handles Socket.IO communication with the game server
 * @module NetworkManager
 * @author Claude Code
 * @version 2.0.0
 */

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
    // BUGFIX (multi): use 'app:ping'/'app:pong' instead of 'ping'/'pong' to avoid
    // collision with Socket.IO's internal heartbeat events. The collision was
    // causing latency to be measured against random heartbeats and acks were
    // never resolved (server did not handle the custom 'ping' event).
    const pingHandler = () => {
      this.lastPingTime = performance.now();
    };

    const pongHandler = () => {
      if (this.lastPingTime) {
        const latency = Math.round(performance.now() - this.lastPingTime);
        this.updateLatency(latency);
      }
    };

    this.socket.on('app:ping', pingHandler);
    this.socket.on('app:pong', pongHandler);
    this.listeners.push({ event: 'app:ping', handler: pingHandler });
    this.listeners.push({ event: 'app:pong', handler: pongHandler });

    // Manual ping every 2 seconds for accurate RTT measurement.
    const timerMgr = window.timerManager;
    const doPing = () => {
      if (this.socket.connected) {
        const start = performance.now();
        this.socket.emit('app:ping', start, _ack => {
          const latency = Math.round(performance.now() - start);
          this.updateLatency(latency);
        });
      }
    };
    if (timerMgr) {
      this.pingIntervalId = timerMgr.setInterval(doPing, 2000);
    } else {
      this.pingInterval = setInterval(doPing, 2000);
    }
  }

  updateLatency(latency) {
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
    if (latency > 200) {
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
    this.on('mutatorsUpdated', data => this.handleMutatorsUpdated(data));
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

      // Large difference (> 500px) = trust server (anti-cheat or major desync)
      // Increased threshold to allow more client prediction freedom
      if (distance > 500) {
        console.log(
          '[Socket.IO] Large position difference in full state, accepting server position:',
          distance.toFixed(1),
          'px'
        );
        // Server position is already applied, no change needed
      } else {
        // Small/medium difference (< 500px) = ALWAYS trust client prediction for fluid movement
        // No interpolation to avoid any lag feeling on local player
        window.gameState.state.players[window.gameState.playerId].x = localPlayerState.x;
        window.gameState.state.players[window.gameState.playerId].y = localPlayerState.y;
        window.gameState.state.players[window.gameState.playerId].angle = localPlayerState.angle;
      }
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

    // Apply delta updates
    if (delta.updated) {
      Object.entries(delta.updated).forEach(([type, entities]) => {
        if (!window.gameState.state[type]) {
          window.gameState.state[type] = {};
        }
        Object.entries(entities).forEach(([id, entity]) => {
          // For local player: only update non-position attributes (health, etc.)
          // Position is handled by client prediction
          if (type === 'players' && id === window.gameState.playerId && localPlayerState) {
            // Preserve local position/angle but update other attributes
            const currentPos = {
              x: localPlayerState.x,
              y: localPlayerState.y,
              angle: localPlayerState.angle
            };
            window.gameState.state[type][id] = entity;
            window.gameState.state[type][id].x = currentPos.x;
            window.gameState.state[type][id].y = currentPos.y;
            window.gameState.state[type][id].angle = currentPos.angle;
          } else {
            // For other entities: apply update normally
            window.gameState.state[type][id] = entity;
          }
          // Mark entity as seen to prevent orphan cleanup
          window.gameState.markEntitySeen(type, id);
        });
      });
    }

    // Remove deleted entities
    if (delta.removed) {
      Object.entries(delta.removed).forEach(([type, ids]) => {
        if (window.gameState.state[type]) {
          ids.forEach(id => {
            delete window.gameState.state[type][id];
          });
        }
      });
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

    // Server reconciliation: check if server position differs significantly
    // Increased tolerance to 200px to reduce rubber banding
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

      // Large difference (> 500px) = trust server (anti-cheat or major desync)
      // Increased threshold to allow more client prediction freedom
      if (distance > 500) {
        console.log(
          '[Socket.IO] Large position difference detected, accepting server position:',
          distance.toFixed(1),
          'px'
        );
        window.gameState.state.players[window.gameState.playerId].x = serverPlayer.x;
        window.gameState.state.players[window.gameState.playerId].y = serverPlayer.y;
        window.gameState.state.players[window.gameState.playerId].angle = serverPlayer.angle;
      }
      // Small/medium differences (< 500px) = ALWAYS trust client prediction for fluid movement
      // No interpolation to avoid any lag feeling on local player
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
    console.log('[Socket.IO] Position corrected by server:', data);

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

      // Smart interpolation based on correction size
      // Small corrections (< 30px) = likely collision correction → smooth interpolation
      // Large corrections (>= 30px) = likely anti-cheat/teleport → immediate correction
      if (correctionDistance < 30) {
        // Smooth interpolation for small corrections
        const interpolationFactor = 0.5;
        player.x += dx * interpolationFactor;
        player.y += dy * interpolationFactor;
        console.log(
          '[Socket.IO] Small correction interpolated. Distance:',
          correctionDistance.toFixed(1),
          'px'
        );
      } else {
        // Immediate correction for large differences (anti-cheat, desync)
        player.x = data.x;
        player.y = data.y;
        console.log(
          '[Socket.IO] Large correction applied immediately. Distance:',
          correctionDistance.toFixed(1),
          'px'
        );
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
    const localPlayer = window.gameState && window.gameState.getPlayer && window.gameState.getPlayer();
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
    this._queueEmit('playerMove', { x, y, angle });
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
