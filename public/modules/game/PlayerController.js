/**
 * PLAYER CONTROLLER
 * Handles player movement, shooting, and client-side prediction
 * Frame-independent movement with delta time and smart network throttling
 * @module PlayerController
 * @author Claude Code
 * @version 3.0.0
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
    this.networkUpdateIntervalMoving = 1000 / 30; // 30 Hz when moving
    this.networkUpdateIntervalFast = 1000 / 60; // 60 Hz for direction changes

    // Movement state for adaptive rate
    this.lastMovementVector = { dx: 0, dy: 0 };
    this.lastSentPosition = { x: 0, y: 0, angle: 0 };
    this.positionThreshold = 2; // Only send if moved more than 2 pixels
    this.angleThreshold = 0.05; // Only send if angle changed significantly

    // Input sequence for reconciliation
    this.lastAcknowledgedSequence = 0;

    // Velocity smoothing for interpolation
    this.velocity = { x: 0, y: 0 };
    this.velocitySmoothing = 0.8; // Higher = more responsive
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
      if (x + size > wall.x &&
        x - size < wall.x + wall.width &&
        y + size > wall.y &&
        y - size < wall.y + wall.height) {
        return true;
      }
    }
    return false;
  }

  /**
   * Main update method with frame-independent movement
   * @param {number} canvasWidth - Canvas width in CSS pixels
   * @param {number} canvasHeight - Canvas height in CSS pixels
   * @param {number} deltaTime - Time since last frame in ms (optional, calculated if not provided)
   */
  update(canvasWidth, canvasHeight, deltaTime) {
    const player = this.gameState.getPlayer();
    if (!player || !player.alive) {
      return;
    }

    // Calculate delta time if not provided
    const now = performance.now();
    if (deltaTime === undefined) {
      deltaTime = now - this.lastUpdateTime;
    }
    this.lastUpdateTime = now;

    // Clamp delta time to prevent huge jumps after tab switch
    deltaTime = Math.min(deltaTime, 100); // Max 100ms delta

    // Calculate delta time factor for frame-independent movement
    // If running at 60 FPS (16.67ms), factor = 1.0
    const deltaFactor = deltaTime / this.targetFrameTime;

    // Always update camera to follow player, even before game starts
    this.camera.follow(player, canvasWidth, canvasHeight, deltaTime);

    // Only allow movement after game has started
    if (!this.gameStarted) {
      return;
    }

    // Get movement vector
    const movement = this.input.getMovementVector();
    const { dx, dy, magnitude } = movement;

    // Detect direction change for adaptive network rate
    const directionChanged =
      (this.lastMovementVector.dx !== 0 || this.lastMovementVector.dy !== 0) &&
      (Math.sign(dx) !== Math.sign(this.lastMovementVector.dx) ||
       Math.sign(dy) !== Math.sign(this.lastMovementVector.dy));

    this.lastMovementVector = { dx, dy };

    // Calculate aim angle (always update for smooth aiming)
    let angle;
    if (this.input.mobileControls && this.input.mobileControls.isActive()) {
      // Mobile: aim in movement direction
      if (magnitude > 0.1) {
        angle = Math.atan2(dy, dx);
      } else {
        angle = player.angle; // Keep current angle when stationary
      }
    } else {
      // Desktop: aim at mouse
      const cameraPos = this.camera.getPosition();
      const mouseWorldX = this.input.mouse.x + cameraPos.x;
      const mouseWorldY = this.input.mouse.y + cameraPos.y;
      angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
    }

    if (dx !== 0 || dy !== 0) {
      // Calculate speed with multipliers and delta time
      const baseSpeed = this.gameState.config.PLAYER_SPEED;
      let speed = baseSpeed * (player.speedMultiplier || 1);

      if (player.speedBoost && now < player.speedBoost) {
        speed *= 1.5;
      }

      if (player.slowedUntil && now < player.slowedUntil) {
        speed *= (player.slowAmount || 1);
      }

      // Apply delta factor for frame-independent movement
      const frameSpeed = speed * deltaFactor;

      // Calculate target velocity
      const targetVelX = dx * frameSpeed;
      const targetVelY = dy * frameSpeed;

      // Smooth velocity for less jerky movement
      this.velocity.x = this.velocity.x * (1 - this.velocitySmoothing) + targetVelX * this.velocitySmoothing;
      this.velocity.y = this.velocity.y * (1 - this.velocitySmoothing) + targetVelY * this.velocitySmoothing;

      // Calculate new position
      const newX = player.x + this.velocity.x;
      const newY = player.y + this.velocity.y;

      // Client-side collision detection with sliding
      let finalX = player.x;
      let finalY = player.y;

      // Try to move in both directions
      if (!this.checkWallCollision(newX, newY, this.gameState.config.PLAYER_SIZE)) {
        finalX = newX;
        finalY = newY;
      } else {
        // Collision detected, try sliding along walls
        if (!this.checkWallCollision(newX, player.y, this.gameState.config.PLAYER_SIZE)) {
          finalX = newX;
        }
        if (!this.checkWallCollision(player.x, newY, this.gameState.config.PLAYER_SIZE)) {
          finalY = newY;
        }
      }

      // Clamp position to map boundaries
      const wallThickness = this.gameState.config.WALL_THICKNESS || 40;
      const playerSize = this.gameState.config.PLAYER_SIZE || 20;

      finalX = Math.max(wallThickness + playerSize, Math.min(this.gameState.config.ROOM_WIDTH - wallThickness - playerSize, finalX));
      finalY = Math.max(wallThickness + playerSize, Math.min(this.gameState.config.ROOM_HEIGHT - wallThickness - playerSize, finalY));

      // Client-side prediction: update position immediately
      player.x = finalX;
      player.y = finalY;
      player.angle = angle;

      // Record input for reconciliation
      const _inputSequence = this.input.recordInput(finalX, finalY, angle, deltaTime);

      // Adaptive network throttling
      const positionDelta = Math.sqrt(
        Math.pow(finalX - this.lastSentPosition.x, 2) +
        Math.pow(finalY - this.lastSentPosition.y, 2)
      );
      const angleDelta = Math.abs(angle - this.lastSentPosition.angle);

      // Choose network update interval based on movement state
      let networkInterval = this.networkUpdateIntervalMoving;
      if (directionChanged) {
        networkInterval = this.networkUpdateIntervalFast; // Send immediately on direction change
      }

      // Send update if enough time passed AND position/angle changed significantly
      const timeSinceLastUpdate = now - this.lastNetworkUpdate;
      const shouldSend = timeSinceLastUpdate >= networkInterval &&
        (positionDelta > this.positionThreshold || angleDelta > this.angleThreshold);

      if (shouldSend) {
        this.network.playerMove(finalX, finalY, angle);
        this.lastNetworkUpdate = now;
        this.lastSentPosition = { x: finalX, y: finalY, angle };
      }
    } else {
      // Not moving - decay velocity
      this.velocity.x *= 0.8;
      this.velocity.y *= 0.8;

      // Update angle even when stationary
      if (Math.abs(angle - player.angle) > 0.01) {
        player.angle = angle;

        // Send angle update at idle rate
        const timeSinceLastUpdate = now - this.lastNetworkUpdate;
        if (timeSinceLastUpdate >= this.networkUpdateIntervalIdle) {
          const angleDelta = Math.abs(angle - this.lastSentPosition.angle);
          if (angleDelta > this.angleThreshold) {
            this.network.playerMove(player.x, player.y, angle);
            this.lastNetworkUpdate = now;
            this.lastSentPosition = { x: player.x, y: player.y, angle };
          }
        }
      }
    }

    // Update input manager's idle state
    this.input.updateIdleState();

    // Clear just-pressed keys at end of frame
    this.input.clearJustPressed();
  }

  shoot(_canvasWidth, _canvasHeight) {
    const player = this.gameState.getPlayer();
    if (!player || !player.alive || !this.gameStarted) {
      return;
    }

    // Convertir les coordonnées écran de la souris en coordonnées monde
    const cameraPos = this.camera.getPosition();
    const mouseWorldX = this.input.mouse.x + cameraPos.x;
    const mouseWorldY = this.input.mouse.y + cameraPos.y;
    // Calculer l'angle du joueur vers la souris
    const angle = Math.atan2(
      mouseWorldY - player.y,
      mouseWorldX - player.x
    );

    // Jouer le son de tir
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
