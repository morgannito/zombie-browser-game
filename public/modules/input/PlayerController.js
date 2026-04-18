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

    // Network rate — 60Hz when moving (every rAF), 20Hz when only aiming.
    // Emit absolute {x, y, angle, seq}. No batching, no reconciliation:
    // the server broadcasts player positions and the client trusts them.
    this.lastNetworkUpdate = 0;
    this.NET_INTERVAL_MOVING = 1000 / 60;
    this.NET_INTERVAL_IDLE = 1000 / 20;

    this.lastMovementVector = { dx: 0, dy: 0 };
    this.lastSentPosition = { x: 0, y: 0, angle: 0 };
    this.positionThreshold = 2;
    this.angleThreshold = 0.05;
    this._nextSeq = 1;

    // Velocity smoothing for local prediction (client-only).
    // 1.0 = no smoothing (instant response), lower = smoother but more lag.
    this.velocity = { x: 0, y: 0 };
    this.velocitySmoothing = 1.0;
  }

  // Reconciliation removed: the server's broadcast stream is authoritative and
  // provides position updates every tick. The old active re-snap on moveAck
  // produced mid-frame teleports into zombies (instant death), and batching
  // added unnecessary complexity for a web game with sub-100ms RTT.
  reconcileWithServer(_ack) {
    /* no-op, kept for API compatibility with NetworkManager.handleMoveAck */
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
    let blockedX = false;
    let blockedY = false;

    if (!this.checkWallCollision(newX, newY, size)) {
      finalX = newX;
      finalY = newY;
    } else {
      if (!this.checkWallCollision(newX, player.y, size)) {
        finalX = newX;
      } else {
        blockedX = true;
      }
      if (!this.checkWallCollision(player.x, newY, size)) {
        finalY = newY;
      } else {
        blockedY = true;
      }
    }

    // Cancel velocity on blocked axes to avoid drift vs server clamp.
    if (blockedX) {
this.velocity.x = 0;
}
    if (blockedY) {
this.velocity.y = 0;
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
   * Emit an absolute player move to the server. 30Hz throttle, no batching,
   * no delta encoding. Server is authoritative and replies via the normal
   * broadcast stream — we do not reconcile local prediction.
   */
  _maybeEmitMove(finalX, finalY, angle, _directionChanged, now) {
    const positionDelta = Math.hypot(
      finalX - this.lastSentPosition.x,
      finalY - this.lastSentPosition.y
    );
    const angleDelta = Math.abs(angle - this.lastSentPosition.angle);
    if (now - this.lastNetworkUpdate < this.NET_INTERVAL_MOVING) {
return;
}
    if (positionDelta <= this.positionThreshold && angleDelta <= this.angleThreshold) {
return;
}

    this.network.playerMove({
      x: finalX,
      y: finalY,
      angle,
      seq: this._nextSeq++
    });
    this.lastNetworkUpdate = now;
    this.lastSentPosition = { x: finalX, y: finalY, angle };
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
    this.camera.setMouse(this.input.mouse.x, this.input.mouse.y);
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
      this._maybeEmitMove(finalX, finalY, angle, directionChanged, now);
    } else {
      // Not moving — decay velocity
      this.velocity.x *= 0.8;
      this.velocity.y *= 0.8;

      // Update angle even when stationary — emit at 20Hz when aiming only.
      if (Math.abs(angle - player.angle) > 0.01) {
        player.angle = angle;
        const timeSinceLastUpdate = now - this.lastNetworkUpdate;
        if (timeSinceLastUpdate >= this.NET_INTERVAL_IDLE) {
          const angleDelta = Math.abs(angle - this.lastSentPosition.angle);
          if (angleDelta > this.angleThreshold) {
            this.network.playerMove({
              x: player.x,
              y: player.y,
              angle,
              seq: this._nextSeq++
            });
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

    // Include client-predicted position so the server can spawn the bullet
    // from where the player visually sees themselves — otherwise long-range
    // shots miss because the server uses its own (slightly different) player
    // position and the angle + server origin ≠ the visual crosshair target.
    this.network.shoot(angle, player.x, player.y);
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
