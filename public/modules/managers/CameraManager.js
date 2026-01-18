/**
 * CAMERA MANAGER
 * Manages camera position and viewport culling
 * Frame-independent smoothing with delta time
 * @module CameraManager
 * @author Claude Code
 * @version 3.0.0
 */

class CameraManager {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;

    // Frame-independent smoothing parameters
    this.smoothingSpeed = 8; // Higher = faster camera follow (units per second factor)
    this.targetFrameTime = 1000 / 60; // Base calculations on 60 FPS

    // Velocity-based camera with damping
    this.velocityX = 0;
    this.velocityY = 0;
    this.damping = 0.85; // Velocity damping per frame at 60fps

    // Dead zone to prevent micro-jitter
    this.deadZone = 0.5; // Pixels

    // Look-ahead based on player velocity (optional)
    this.lookAheadEnabled = true;
    this.lookAheadFactor = 0.15; // How much to look ahead
    this.lastPlayerX = 0;
    this.lastPlayerY = 0;

    // Screen shake support
    this.shakeOffset = { x: 0, y: 0 };
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeStartTime = 0;
  }

  /**
   * Follow player with frame-independent smoothing
   * @param {Object} player - Player object with x, y position
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {number} deltaTime - Time since last frame in ms (optional)
   */
  follow(player, canvasWidth, canvasHeight, deltaTime) {
    // Default delta time if not provided
    if (deltaTime === undefined) {
      deltaTime = this.targetFrameTime;
    }

    // Clamp delta time
    deltaTime = Math.min(deltaTime, 100);

    // Calculate delta factor for frame-independent movement
    const deltaFactor = deltaTime / this.targetFrameTime;

    // Calculate player velocity for look-ahead
    let lookAheadX = 0;
    let lookAheadY = 0;

    if (this.lookAheadEnabled) {
      const playerVelX = player.x - this.lastPlayerX;
      const playerVelY = player.y - this.lastPlayerY;

      // Smooth look-ahead based on velocity
      lookAheadX = playerVelX * this.lookAheadFactor * 10; // Scale up for visibility
      lookAheadY = playerVelY * this.lookAheadFactor * 10;

      // Clamp look-ahead to reasonable bounds
      const maxLookAhead = 100;
      lookAheadX = Math.max(-maxLookAhead, Math.min(maxLookAhead, lookAheadX));
      lookAheadY = Math.max(-maxLookAhead, Math.min(maxLookAhead, lookAheadY));
    }

    this.lastPlayerX = player.x;
    this.lastPlayerY = player.y;

    // Calculate target camera position (centered on player + look-ahead)
    const targetX = player.x + lookAheadX - canvasWidth / 2;
    const targetY = player.y + lookAheadY - canvasHeight / 2;

    // Calculate distance to target
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Apply dead zone to prevent micro-jitter
    if (distance < this.deadZone) {
      this.velocityX *= this.damping;
      this.velocityY *= this.damping;
    } else {
      // Calculate smoothing factor with frame-independence
      // Using exponential smoothing: factor = 1 - e^(-speed * dt)
      const smoothFactor = 1 - Math.exp(-this.smoothingSpeed * deltaTime / 1000);

      // Apply smoothed movement
      this.velocityX = dx * smoothFactor;
      this.velocityY = dy * smoothFactor;
    }

    // Apply velocity
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Apply screen shake if active
    this.updateShake(deltaTime);
    const finalX = this.x + this.shakeOffset.x;
    const finalY = this.y + this.shakeOffset.y;

    this.width = canvasWidth;
    this.height = canvasHeight;

    return { x: finalX, y: finalY };
  }

  /**
   * Instantly recenter camera on player (no easing)
   * Use this to fix camera bugs or when player gets repositioned
   */
  recenter(player, canvasWidth, canvasHeight) {
    this.x = player.x - canvasWidth / 2;
    this.y = player.y - canvasHeight / 2;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastPlayerX = player.x;
    this.lastPlayerY = player.y;
    this.width = canvasWidth;
    this.height = canvasHeight;
  }

  /**
   * Add screen shake effect
   * @param {number} intensity - Shake intensity in pixels
   * @param {number} duration - Duration in ms
   */
  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeStartTime = performance.now();
  }

  /**
   * Update screen shake
   * @param {number} deltaTime - Time since last frame
   */
  updateShake(deltaTime) {
    if (this.shakeIntensity <= 0 || this.shakeDuration <= 0) {
      this.shakeOffset = { x: 0, y: 0 };
      return;
    }

    const elapsed = performance.now() - this.shakeStartTime;
    if (elapsed >= this.shakeDuration) {
      this.shakeIntensity = 0;
      this.shakeOffset = { x: 0, y: 0 };
      return;
    }

    // Decay intensity over time
    const progress = elapsed / this.shakeDuration;
    const currentIntensity = this.shakeIntensity * (1 - progress);

    // Random offset with perlin-like smoothing
    this.shakeOffset = {
      x: (Math.random() - 0.5) * 2 * currentIntensity,
      y: (Math.random() - 0.5) * 2 * currentIntensity
    };
  }

  getPosition() {
    return {
      x: this.x + this.shakeOffset.x,
      y: this.y + this.shakeOffset.y
    };
  }

  /**
   * Get raw position without shake
   */
  getRawPosition() {
    return { x: this.x, y: this.y };
  }

  /**
   * Set camera smoothing speed
   * @param {number} speed - Smoothing speed (1-20 recommended, higher = faster)
   */
  setSmoothingSpeed(speed) {
    this.smoothingSpeed = Math.max(1, Math.min(20, speed));
  }

  /**
   * Enable/disable look-ahead
   * @param {boolean} enabled - Whether to enable look-ahead
   * @param {number} factor - Look-ahead factor (0-1)
   */
  setLookAhead(enabled, factor = 0.15) {
    this.lookAheadEnabled = enabled;
    this.lookAheadFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * Check if entity is visible in viewport with margin
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   * @param {number} margin - Extra margin around viewport
   * @returns {boolean} True if visible
   */
  isInViewport(x, y, margin = 100) {
    const camX = this.x + this.shakeOffset.x;
    const camY = this.y + this.shakeOffset.y;
    return (
      x + margin >= camX &&
      x - margin <= camX + this.width &&
      y + margin >= camY &&
      y - margin <= camY + this.height
    );
  }

  /**
   * Get viewport bounds for culling
   * @param {number} margin - Extra margin
   * @returns {{left: number, right: number, top: number, bottom: number}}
   */
  getViewportBounds(margin = 0) {
    const camX = this.x + this.shakeOffset.x;
    const camY = this.y + this.shakeOffset.y;
    return {
      left: camX - margin,
      right: camX + this.width + margin,
      top: camY - margin,
      bottom: camY + this.height + margin
    };
  }
}

// Export to window
window.CameraManager = CameraManager;
