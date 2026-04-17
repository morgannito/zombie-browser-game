/**
 * PLAYER CONTROLLER
 * Handles player movement, shooting, and client-side prediction
 * Frame-independent movement with delta time and smart network throttling
 * @module PlayerController
 * @author Claude Code
 * @version 3.1.0
 */

class PlayerController {
  constructor(inputManager, networkManager, gameState, camera) {
    this.input = inputManager;
    this.network = networkManager;
    this.gameState = gameState;
    this.camera = camera;
    this.nickname = null;
    this.gameStarted = false;
    this.spawnProtectionEndTime = 0;

    // Frame-independent movement
    this.lastUpdateTime = performance.now();
    this.targetFrameTime = 1000 / 60; // Base calculations on 60 FPS

    // Adaptive network update rate based on movement
    this.lastNetworkUpdate = 0;
    this.networkUpdateIntervalIdle = 1000 / 20; // 20 Hz when idle
    this.networkUpdateIntervalMoving = 1000 / 30; // 30 Hz when moving (60Hz triggered anti-cheat budget rejections)
    this.networkUpdateIntervalFast = 1000 / 60; // 60 Hz on direction change (burst)

    // Movement state for adaptive rate
    this.lastMovementVector = { dx: 0, dy: 0 };
    this.lastSentPosition = { x: 0, y: 0, angle: 0 };
    this.positionThreshold = 2; // Only send if moved more than 2 pixels
    this.angleThreshold = 0.05; // Only send if angle changed significantly

    // Input sequence for reconciliation — bumped per queued move, ACKed by server.
    this.lastAcknowledgedSequence = 0;
    this._nextSeq = 1;

    // Instant stop emit was removed — it caused rapid double-emits that
    // tripped the server's movement budget anti-cheat, producing visible rollbacks.
    // The 30Hz throttle is short enough to convey stops naturally.

    // Velocity smoothing for interpolation
    this.velocity = { x: 0, y: 0 };
    this.velocitySmoothing = 0.8; // 80% toward target per frame = snappy response (not lowered)

    // Input batching: accumulate up to BATCH_SIZE moves then flush in one WS frame.
    // Each item is {dx, dy, angle} (delta-encoded from the position before that move).
    // This cuts WS frame count by ~3x at 30Hz moving (one batch per 3 frames instead
    // of one frame per move) while preserving anti-cheat compatibility on the server.
    this._inputBatch = [];
    this._batchSize = 3; // flush after accumulating 3 moves (≈100ms at 30Hz)
    this._lastBatchFlush = 0;

    // Reconciliation ring: inputs awaiting server ACK. On moveAck we snap to
    // the authoritative position then replay the still-unacked inputs to
    // reconstruct the client-predicted pose — eliminates visible rollbacks
    // on small server corrections.
    this._pendingInputs = []; // [{seq, dx, dy}]
    this.RECONCILE_MAX_DIVERGENCE_PX = 50;
  }

  /**
   * Called by NetworkManager.handleMoveAck. Reconciles client prediction
   * against the authoritative server position for the acked input sequence,
   * then replays still-unacked inputs locally.
   */
  reconcileWithServer(ack) {
    if (!ack || typeof ack.seq !== 'number') {
      return;
    }
    this.lastAcknowledgedSequence = ack.seq;
    this._pendingInputs = this._pendingInputs.filter(i => i.seq > ack.seq);

    const player = this.gameState.state.players[this.gameState.playerId];
    if (!player || !player.alive) {
      return;
    }

    // Safety: if divergence is huge (>50px), let the server's explicit
    // positionCorrection handler take over rather than snapping here.
    const dxCurr = player.x - ack.x;
    const dyCurr = player.y - ack.y;
    if (Math.hypot(dxCurr, dyCurr) > this.RECONCILE_MAX_DIVERGENCE_PX) {
      return;
    }

    // Snap to server-authoritative position, then re-apply unacked inputs.
    player.x = ack.x;
    player.y = ack.y;
    for (const inp of this._pendingInputs) {
      const resolved = this._resolveCollision(player, player.x + inp.dx, player.y + inp.dy);
      player.x = resolved.finalX;
      player.y = resolved.finalY;
    }
  }

  setNickname(nickname) {
    this.nickname = nickname;
    this.gameStarted = true;
    this.network.setNickname(nickname);

    // Start spawn protection
    this.spawnProtectionEndTime = Date.now() + CONSTANTS.SPAWN_PROTECTION.DURATION;
  }

  /**
   * Check if a position collides with any wall
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} size - Object size/radius
   * @returns {boolean} - True if collision detected
   */
  checkWallCollision(x, y, size) {
    const walls = this.gameState.state.walls;
    if (!walls || !Array.isArray(walls)) {
      return false;
    }

    for (const wall of walls) {
      if (
        x + size > wall.x &&
        x - size < wall.x + wall.width &&
        y + size > wall.y &&
        y - size < wall.y + wall.height
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Compute a frame-speed-adjusted movement vector with velocity smoothing.
   * Mutates this.velocity in place and returns the candidate position.
   * @param {object} player
   * @param {number} dx - Normalised x direction
   * @param {number} dy - Normalised y direction
   * @param {number} deltaFactor
   * @param {number} now - performance.now() timestamp
   * @returns {{ newX: number, newY: number }}
   */
  _computeMovementVector(player, dx, dy, deltaFactor, now) {
    const baseSpeed = this.gameState.config.PLAYER_SPEED;
    let speed = baseSpeed * (player.speedMultiplier || 1);
    if (player.speedBoost && now < player.speedBoost) {
      speed *= 1.5;
    }
    if (player.slowedUntil && now < player.slowedUntil) {
      speed *= player.slowAmount || 1;
    }

    const frameSpeed = speed * deltaFactor;
    this.velocity.x =
      this.velocity.x * (1 - this.velocitySmoothing) + dx * frameSpeed * this.velocitySmoothing;
    this.velocity.y =
      this.velocity.y * (1 - this.velocitySmoothing) + dy * frameSpeed * this.velocitySmoothing;

    return { newX: player.x + this.velocity.x, newY: player.y + this.velocity.y };
  }

  /**
   * Resolve collision with wall sliding, then clamp to map bounds.
   * @param {object} player
   * @param {number} newX
   * @param {number} newY
   * @returns {{ finalX: number, finalY: number }}
   */
  _resolveCollision(player, newX, newY) {
    const size = this.gameState.config.PLAYER_SIZE;
    let finalX = player.x;
    let finalY = player.y;

    if (!this.checkWallCollision(newX, newY, size)) {
      finalX = newX;
      finalY = newY;
    } else {
      if (!this.checkWallCollision(newX, player.y, size)) {
        finalX = newX;
      }
      if (!this.checkWallCollision(player.x, newY, size)) {
        finalY = newY;
      }
    }

    const wt = this.gameState.config.WALL_THICKNESS || 40;
    const ps = this.gameState.config.PLAYER_SIZE || 20;
    finalX = Math.max(wt + ps, Math.min(this.gameState.config.ROOM_WIDTH - wt - ps, finalX));
    finalY = Math.max(wt + ps, Math.min(this.gameState.config.ROOM_HEIGHT - wt - ps, finalY));

    return { finalX, finalY };
  }

  /**
   * Compute the aiming angle for the current frame.
   * @param {object} player
   * @param {number} magnitude - Input magnitude (mobile)
   * @param {number} dx
   * @param {number} dy
   * @returns {number} angle in radians
   */
  _computeAimAngle(player, magnitude, dx, dy) {
    if (this.input.mobileControls && this.input.mobileControls.isActive()) {
      return magnitude > 0.1 ? Math.atan2(dy, dx) : player.angle;
    }
    const cameraPos = this.camera.getPosition();
    const mouseWorldX = this.input.mouse.x + cameraPos.x;
    const mouseWorldY = this.input.mouse.y + cameraPos.y;
    return Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
  }

  /**
   * Flush the accumulated input batch as a single playerMoveBatch WS frame.
   */
  _flushBatch() {
    if (this._inputBatch.length === 0) {
      return;
    }
    this.network.playerMoveBatch(this._inputBatch);
    this._inputBatch = [];
  }

  /**
   * Conditionally queue a move into the input batch and flush when the batch
   * is full or the direction-change burst interval is reached.
   *
   * Delta encoding: each batch item carries {dx, dy, angle} relative to the
   * position at which the move was computed — server reconstructs absolute coords
   * sequentially. This halves payload size vs. sending absolute x,y per move.
   *
   * @param {object} player
   * @param {number} finalX
   * @param {number} finalY
   * @param {number} angle
   * @param {boolean} directionChanged
   * @param {number} now
   */
  _maybeEmitMove(player, finalX, finalY, angle, directionChanged, now) {
    const positionDelta = Math.hypot(
      finalX - this.lastSentPosition.x,
      finalY - this.lastSentPosition.y
    );
    const angleDelta = Math.abs(angle - this.lastSentPosition.angle);
    // Adaptive rate: degrade to 20Hz when latency is high to avoid congesting
    // the uplink pipe and compounding the delay the player already feels.
    const netLatency = window.networkManager && window.networkManager.latency ? window.networkManager.latency : 0;
    const highLatency = netLatency > 200;
    let networkInterval = directionChanged
      ? this.networkUpdateIntervalFast
      : this.networkUpdateIntervalMoving;
    if (highLatency && !directionChanged) {
      networkInterval = 1000 / 20;
    }
    const timeSinceLastUpdate = now - this.lastNetworkUpdate;

    const shouldQueue =
      timeSinceLastUpdate >= networkInterval &&
      (positionDelta > this.positionThreshold || angleDelta > this.angleThreshold);

    if (!shouldQueue) {
return;
}

    // Delta-encode relative to last sent position so the server can reconstruct
    // absolute coordinates by accumulating deltas from player.x/player.y.
    const dx = finalX - this.lastSentPosition.x;
    const dy = finalY - this.lastSentPosition.y;
    const inputSeq = this._nextSeq++;
    this._inputBatch.push({ dx, dy, angle, seq: inputSeq });
    this._pendingInputs.push({ seq: inputSeq, dx, dy });
    if (this._pendingInputs.length > 64) {
      this._pendingInputs.shift();
    }
    this.lastNetworkUpdate = now;
    this.lastSentPosition = { x: finalX, y: finalY, angle };

    // Flush immediately on direction change (burst) or when batch is full.
    if (directionChanged || this._inputBatch.length >= this._batchSize) {
      this._flushBatch();
    }
  }

  /**
   * Main update method with frame-independent movement
   * @param {number} canvasWidth - Canvas width in CSS pixels
   * @param {number} canvasHeight - Canvas height in CSS pixels
   * @param {number} deltaTime - Time since last frame in ms (optional, calculated if not provided)
   */
  update(canvasWidth, canvasHeight, deltaTime) {
    const now = performance.now();
    const player = this.gameState.getPlayer();
    if (!player || !player.alive) {
      return;
    }

    if (deltaTime === undefined) {
      deltaTime = now - this.lastUpdateTime;
    }
    this.lastUpdateTime = now;
    deltaTime = Math.min(deltaTime, 100);

    const deltaFactor = deltaTime / this.targetFrameTime;

    // Always update camera even before game starts
    this.camera.follow(player, canvasWidth, canvasHeight, deltaTime);
    if (!this.gameStarted) {
      return;
    }

    const { dx, dy, magnitude } = this.input.getMovementVector();

    const directionChanged =
      (this.lastMovementVector.dx !== 0 || this.lastMovementVector.dy !== 0) &&
      (Math.sign(dx) !== Math.sign(this.lastMovementVector.dx) ||
        Math.sign(dy) !== Math.sign(this.lastMovementVector.dy));
    this.lastMovementVector = { dx, dy };

    const angle = this._computeAimAngle(player, magnitude, dx, dy);

    if (dx !== 0 || dy !== 0) {
      const { newX, newY } = this._computeMovementVector(player, dx, dy, deltaFactor, now);
      const { finalX, finalY } = this._resolveCollision(player, newX, newY);

      // Client-side prediction: update position immediately
      player.x = finalX;
      player.y = finalY;
      player.angle = angle;

      this.input.recordInput(finalX, finalY, angle, deltaTime);
      this._maybeEmitMove(player, finalX, finalY, angle, directionChanged, now);
    } else {
      // Not moving — decay velocity
      this.velocity.x *= 0.8;
      this.velocity.y *= 0.8;

      // Update angle even when stationary
      if (Math.abs(angle - player.angle) > 0.01) {
        player.angle = angle;
        const timeSinceLastUpdate = now - this.lastNetworkUpdate;
        if (timeSinceLastUpdate >= this.networkUpdateIntervalIdle) {
          const angleDelta = Math.abs(angle - this.lastSentPosition.angle);
          if (angleDelta > this.angleThreshold) {
            // Angle-only update: dx/dy = 0, flush immediately (no batching needed at 20Hz idle).
            this._inputBatch.push({ dx: 0, dy: 0, angle, seq: this._nextSeq++ });
            this._flushBatch();
            this.lastNetworkUpdate = now;
            this.lastSentPosition = { x: player.x, y: player.y, angle };
          }
        }
      }
    }

    this.input.updateIdleState();
    this.input.clearJustPressed();
  }

  shoot(_canvasWidth, _canvasHeight) {
    const player = this.gameState.getPlayer();
    if (!player || !player.alive || !this.gameStarted) {
      return;
    }

    const cameraPos = this.camera.getPosition();
    const mouseWorldX = this.input.mouse.x + cameraPos.x;
    const mouseWorldY = this.input.mouse.y + cameraPos.y;
    const angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);

    if (window.onPlayerShoot) {
      window.onPlayerShoot(player.x, player.y, angle, player.weapon || 'pistol');
    }

    // CLIENT-SIDE PREDICTION: Create predicted bullet immediately for zero input lag
    if (this.gameState.createPredictedBullet) {
      this.gameState.createPredictedBullet(player.x, player.y, angle, player.weapon || 'pistol');
    }

    this.network.shoot(angle);
  }

  respawn() {
    this.gameStarted = false;
    this.nickname = null;
    this.network.respawn();
  }

  isSpawnProtectionActive() {
    return Date.now() < this.spawnProtectionEndTime;
  }
}

// Export to window
window.PlayerController = PlayerController;
