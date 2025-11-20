/**
 * CAMERA MANAGER
 * Manages camera position and viewport culling
 * @module CameraManager
 * @author Claude Code
 * @version 2.0.0
 */

class CameraManager {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.easingFactor = 0.1; // Camera smoothness (0.1 = smooth, 1 = instant)
  }

  follow(player, canvasWidth, canvasHeight) {
    // Calculate target camera position
    const targetX = player.x - canvasWidth / 2;
    const targetY = player.y - canvasHeight / 2;

    // Apply easing for smooth camera movement
    this.x += (targetX - this.x) * this.easingFactor;
    this.y += (targetY - this.y) * this.easingFactor;

    this.width = canvasWidth;
    this.height = canvasHeight;
  }

  /**
   * Instantly recenter camera on player (no easing)
   * Use this to fix camera bugs or when player gets repositioned
   */
  recenter(player, canvasWidth, canvasHeight) {
    this.x = player.x - canvasWidth / 2;
    this.y = player.y - canvasHeight / 2;
    this.width = canvasWidth;
    this.height = canvasHeight;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }

  // Vérifie si une entité est visible dans le viewport avec une marge
  isInViewport(x, y, margin = 100) {
    return (
      x + margin >= this.x &&
      x - margin <= this.x + this.width &&
      y + margin >= this.y &&
      y - margin <= this.y + this.height
    );
  }
}

// Export to window
window.CameraManager = CameraManager;
