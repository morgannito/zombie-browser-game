/**
 * PLAYER CONTROLLER
 * Handles player movement, shooting, and client-side prediction
 * @module PlayerController
 * @author Claude Code
 * @version 2.0.0
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

    // OPTIMIZED: Send playerMove at 60 FPS for maximum responsiveness
    // Matches game render rate for instant feedback
    this.lastNetworkUpdate = 0;
    this.networkUpdateInterval = 1000 / 60; // 16.67ms = 60 FPS network updates
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

  update(canvasWidth, canvasHeight) {
    const player = this.gameState.getPlayer();
    if (!player || !player.alive) {
      return;
    }

    // Always update camera to follow player, even before game starts
    this.camera.follow(player, canvasWidth, canvasHeight);

    // Only allow movement after game has started
    if (!this.gameStarted) {
      return;
    }

    // Cache current time for performance (avoid multiple Date.now() calls)
    const now = Date.now();

    // Update movement
    const { dx, dy } = this.input.getMovementVector();

    if (dx !== 0 || dy !== 0) {
      // Calculate speed with multipliers
      let speed = this.gameState.config.PLAYER_SPEED;
      speed *= (player.speedMultiplier || 1);

      if (player.speedBoost && now < player.speedBoost) {
        speed *= 1.5;
      }

      if (player.slowedUntil && now < player.slowedUntil) {
        speed *= (player.slowAmount || 1);
      }

      // Calculate new position
      const newX = player.x + dx * speed;
      const newY = player.y + dy * speed;

      // Calculate aim angle
      let angle;
      // Sur mobile, orienter le canon dans la direction du mouvement du joystick
      if (this.input.mobileControls && this.input.mobileControls.isActive()) {
        angle = Math.atan2(dy, dx);
      } else {
        // Sur desktop, utiliser la position de la souris
        // Convertir les coordonnées écran de la souris en coordonnées monde
        const cameraPos = this.camera.getPosition();
        const mouseWorldX = this.input.mouse.x + cameraPos.x;
        const mouseWorldY = this.input.mouse.y + cameraPos.y;
        // Calculer l'angle du joueur vers la souris
        angle = Math.atan2(
          mouseWorldY - player.y,
          mouseWorldX - player.x
        );
      }

      // Client-side collision detection with sliding
      let finalX = player.x;
      let finalY = player.y;

      // Try to move in both directions
      if (!this.checkWallCollision(newX, newY, this.gameState.config.PLAYER_SIZE)) {
        // No collision, move freely
        finalX = newX;
        finalY = newY;
      } else {
        // Collision detected, try sliding along walls
        // Try X-axis only
        if (!this.checkWallCollision(newX, player.y, this.gameState.config.PLAYER_SIZE)) {
          finalX = newX;
        }
        // Try Y-axis only
        if (!this.checkWallCollision(player.x, newY, this.gameState.config.PLAYER_SIZE)) {
          finalY = newY;
        }
      }

      // Clamp position to map boundaries (inside walls)
      // Walls are WALL_THICKNESS thick at the edges.
      // We must keep the player's circle (radius = size) inside the playable area.
      // However, checkWallCollision uses 'size' as a radius-like margin.
      // To be safe, we clamp to: WallThickness + Size/2 (if size is diameter) or WallThickness + Size (if size is radius)
      // CONFIG.PLAYER_SIZE is 20. In checkWallCollision, we use it as a margin.
      // Let's assume we want to keep the center of the player away from the wall by at least PLAYER_SIZE.

      const wallThickness = this.gameState.config.WALL_THICKNESS || 40;
      const playerSize = this.gameState.config.PLAYER_SIZE || 20;

      // Clamp X
      // Min: Left wall end (40) + player radius (20) = 60
      // Max: Right wall start (2960) - player radius (20) = 2940
      finalX = Math.max(wallThickness + playerSize, Math.min(this.gameState.config.ROOM_WIDTH - wallThickness - playerSize, finalX));

      // Clamp Y
      // Min: Top wall end (40) + player radius (20) = 60
      // Max: Bottom wall start (2360) - player radius (20) = 2340
      finalY = Math.max(wallThickness + playerSize, Math.min(this.gameState.config.ROOM_HEIGHT - wallThickness - playerSize, finalY));

      // Update player position only if it changed
      if (finalX !== player.x || finalY !== player.y) {
        // Client-side prediction (always update immediately for smooth visuals)
        player.x = finalX;
        player.y = finalY;
        player.angle = angle;

        // BALANCED: Throttle network updates to 30 FPS for optimal performance
        // Smooth movement without excessive network traffic
        if (now - this.lastNetworkUpdate >= this.networkUpdateInterval) {
          this.network.playerMove(finalX, finalY, angle);
          this.lastNetworkUpdate = now;
        }
      } else {
        // Position didn't change, but update angle
        player.angle = angle;
      }
    }
  }

  shoot(canvasWidth, canvasHeight) {
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
