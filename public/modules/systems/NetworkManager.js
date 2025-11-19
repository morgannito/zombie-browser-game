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
    this.listeners = []; // Track all listeners for cleanup

    // Latency monitoring
    this.latency = 0; // Current latency in ms
    this.lastPingTime = 0;
    this.latencyHistory = []; // Keep last 10 measurements
    this.maxLatencyHistory = 10;

    this.setupSocketListeners();
    this.setupLatencyMonitoring();
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  setupLatencyMonitoring() {
    // Monitor ping/pong for latency measurement
    this.socket.on('ping', () => {
      this.lastPingTime = Date.now();
    });

    this.socket.on('pong', () => {
      if (this.lastPingTime) {
        const latency = Date.now() - this.lastPingTime;
        this.updateLatency(latency);
      }
    });

    // Manual ping every 2 seconds for more accurate measurements
    this.pingInterval = setInterval(() => {
      if (this.socket.connected) {
        const start = Date.now();
        this.socket.emit('ping', start, (ack) => {
          const latency = Date.now() - start;
          this.updateLatency(latency);
        });
      }
    }, 2000);
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

    // Log high latency warnings
    if (latency > 200) {
      console.warn(`[Network] High latency detected: ${latency}ms`);
    }
  }

  getAverageLatency() {
    if (this.latencyHistory.length === 0) return 0;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  getConnectionQuality() {
    const avgLatency = this.getAverageLatency();

    if (avgLatency < 50) return { text: 'Excellent', color: '#00ff00', class: 'excellent' };
    if (avgLatency < 100) return { text: 'Good', color: '#90ee90', class: 'good' };
    if (avgLatency < 150) return { text: 'Fair', color: '#ffff00', class: 'fair' };
    if (avgLatency < 250) return { text: 'Poor', color: '#ffa500', class: 'poor' };
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
      console.log('[Socket.IO] Connected successfully');
      if (window.toastManager) {
        const quality = this.getConnectionQuality();
        window.toastManager.show(`✅ Connected (${quality.text})`, 'success');
      }
    });

    this.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error);
      if (window.toastManager) {
        window.toastManager.show('⚠️ Connection error. Retrying...', 'warning');
      }
    });

    this.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
      if (window.toastManager) {
        window.toastManager.show('🔌 Disconnected from server', 'error');
      }
    });

    this.on('reconnect', (attemptNumber) => {
      console.log('[Socket.IO] Reconnected after', attemptNumber, 'attempts');
      // Set flag to disable client prediction temporarily
      this.justReconnected = true;
      if (window.toastManager) {
        window.toastManager.show('✅ Reconnected to server', 'success');
      }
    });

    this.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket.IO] Reconnection attempt', attemptNumber);
    });

    this.on('reconnect_error', (error) => {
      console.error('[Socket.IO] Reconnection error:', error);
    });

    this.on('reconnect_failed', () => {
      console.error('[Socket.IO] Reconnection failed');
      if (window.toastManager) {
        window.toastManager.show('❌ Failed to reconnect. Please refresh.', 'error');
      }
    });

    // Game event handlers
    this.on('init', (data) => this.handleInit(data));
    this.on('gameState', (state) => this.handleGameState(state));
    this.on('gameStateDelta', (delta) => this.handleGameStateDelta(delta));
    this.on('positionCorrection', (data) => this.handlePositionCorrection(data));
    this.on('bossSpawned', (data) => this.handleBossSpawned(data));
    this.on('newWave', (data) => this.handleNewWave(data));
    this.on('levelUp', (data) => this.handleLevelUp(data));
    this.on('roomChanged', (data) => this.handleRoomChanged(data));
    this.on('runCompleted', (data) => this.handleRunCompleted(data));
    this.on('upgradeSelected', (data) => this.handleUpgradeSelected(data));
    this.on('shopUpdate', (data) => this.handleShopUpdate(data));
    this.on('comboUpdate', (data) => this.handleComboUpdate(data));
    this.on('comboReset', () => this.handleComboReset());
    this.on('sessionTimeout', (data) => this.handleSessionTimeout(data));
  }

  handleInit(data) {
    window.gameState.initialize(data);

    // Show notification if session was recovered
    if (data.recovered && window.toastManager) {
      window.toastManager.show('🔄 Session restaurée ! Votre progression a été récupérée.', 'success');
      console.log('[Session] State successfully recovered');
    }
  }

  handleGameState(state) {
    // ALWAYS save local player position for client prediction (except right after reconnect)
    let localPlayerState = null;
    if (!this.justReconnected && window.gameState.state && window.gameState.state.players && window.gameState.state.players[window.gameState.playerId]) {
      const localPlayer = window.gameState.state.players[window.gameState.playerId];
      localPlayerState = { x: localPlayer.x, y: localPlayer.y, angle: localPlayer.angle };
    }

    // Update state with server data
    window.gameState.updateState(state);

    // Client prediction: restore local position unless server differs significantly
    if (localPlayerState && window.gameState.state.players && window.gameState.state.players[window.gameState.playerId]) {
      const serverPlayer = window.gameState.state.players[window.gameState.playerId];
      const dx = localPlayerState.x - serverPlayer.x;
      const dy = localPlayerState.y - serverPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Large difference (> 100px) = trust server (anti-cheat or major desync)
      if (distance > 100) {
        console.log('[Socket.IO] Large position difference in full state, accepting server position:', distance.toFixed(1), 'px');
        // Server position is already applied, no change needed
      } else {
        // Small difference = trust client prediction (no rollback)
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
    if (!this.justReconnected && window.gameState.state && window.gameState.state.players && window.gameState.state.players[window.gameState.playerId]) {
      const localPlayer = window.gameState.state.players[window.gameState.playerId];
      localPlayerState = { x: localPlayer.x, y: localPlayer.y, angle: localPlayer.angle };
      prevHealth = localPlayer.health;
      prevMaxHealth = localPlayer.maxHealth;
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
            const currentPos = { x: localPlayerState.x, y: localPlayerState.y, angle: localPlayerState.angle };
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
      if (delta.meta.wave !== undefined) window.gameState.state.wave = delta.meta.wave;
      if (delta.meta.walls !== undefined) window.gameState.state.walls = delta.meta.walls;
      if (delta.meta.currentRoom !== undefined) window.gameState.state.currentRoom = delta.meta.currentRoom;
      if (delta.meta.bossSpawned !== undefined) window.gameState.state.bossSpawned = delta.meta.bossSpawned;
    }

    // Server reconciliation: check if server position differs significantly
    // Only correct if difference is large (> 100px = likely desync/cheat detection)
    if (localPlayerState && delta.updated && delta.updated.players && delta.updated.players[window.gameState.playerId]) {
      const serverPlayer = delta.updated.players[window.gameState.playerId];
      const dx = localPlayerState.x - serverPlayer.x;
      const dy = localPlayerState.y - serverPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Large difference = trust server (anti-cheat correction or major desync)
      if (distance > 100) {
        console.log('[Socket.IO] Large position difference detected, accepting server position:', distance.toFixed(1), 'px');
        window.gameState.state.players[window.gameState.playerId].x = serverPlayer.x;
        window.gameState.state.players[window.gameState.playerId].y = serverPlayer.y;
        window.gameState.state.players[window.gameState.playerId].angle = serverPlayer.angle;
      }
      // Small differences (< 100px) = trust client prediction (no rollback)
    }

    // Clear reconnection flag after first delta update
    if (this.justReconnected) {
      console.log('[Socket.IO] Position resynchronized after reconnection (delta)');
      this.justReconnected = false;
    }

    // Detect damage to player and trigger screen flash (SCREEN EFFECTS)
    if (prevHealth !== null && prevMaxHealth !== null && window.gameState.state.players && window.gameState.state.players[window.gameState.playerId]) {
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
      delta.removed.zombies.forEach(zombieId => {
        // We need to check if it was a boss before removal
        // The server should send a specific event for boss death, but we can also detect it here
        // For now, we'll rely on the bossSpawned meta flag change
      });
    }

    // Detect boss death via bossSpawned flag change
    if (delta.meta && delta.meta.bossSpawned === false && window.gameState.state.bossSpawned === true && window.screenEffects) {
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
    if (window.gameState.state && window.gameState.state.players && window.gameState.state.players[window.gameState.playerId]) {
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
        console.log('[Socket.IO] Small correction interpolated. Distance:', correctionDistance.toFixed(1), 'px');
      } else {
        // Immediate correction for large differences (anti-cheat, desync)
        player.x = data.x;
        player.y = data.y;
        console.log('[Socket.IO] Large correction applied immediately. Distance:', correctionDistance.toFixed(1), 'px');
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
  }

  handleNewWave(data) {
    if (window.gameUI) {
      window.gameUI.showNewWaveAnnouncement(data.wave, data.zombiesCount);
      setTimeout(() => window.gameUI.showShop(), CONSTANTS.ANIMATIONS.SHOP_DELAY);
    }
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
  }

  handleRunCompleted(data) {
    if (window.gameUI) {
      window.gameUI.showRunCompleted(data.gold, data.level);
    }
  }

  handleUpgradeSelected(data) {
    // Upgrade successfully selected
  }

  handleShopUpdate(data) {
    if (data.success && window.gameUI && window.gameUI.shopOpen) {
      window.gameUI.populateShop();
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
      window.toastManager.show('⏱️ Session expirée: ' + (data.reason || 'Inactivité détectée'), 'error');
    }

    // Show alert with option to reload
    setTimeout(() => {
      if (confirm('Votre session a expiré. Voulez-vous recharger la page ?')) {
        window.location.reload();
      }
    }, 500);
  }

  // Send events to server
  setNickname(nickname) {
    this.socket.emit('setNickname', { nickname });
  }

  endSpawnProtection() {
    this.socket.emit('endSpawnProtection');
  }

  playerMove(x, y, angle) {
    this.socket.emit('playerMove', { x, y, angle });
  }

  shoot(angle) {
    this.socket.emit('shoot', { angle });
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
