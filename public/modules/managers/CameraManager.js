/**
 * CAMERA MANAGER
 * Manages camera position and viewport culling
 * Frame-independent smoothing with delta time
 * @module CameraManager
 * @author Claude Code
 * @version 4.0.0
 */

class CameraManager {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;

    // Frame-independent smoothing
    this.smoothingSpeed = 8;
    this.targetFrameTime = 1000 / 60;

    // Velocity-based follow
    this.velocityX = 0;
    this.velocityY = 0;
    this.damping = 0.85;

    // Deadzone: avoid micro-shakes (squared comparison — no Math.sqrt)
    this.deadZone = 0.5;
    this._deadZoneSq = 0.5 * 0.5;

    // Look-ahead (velocity-based)
    this.lookAheadEnabled = true;
    this.lookAheadFactor = 0.15;
    this.lastPlayerX = 0;
    this.lastPlayerY = 0;

    // Mouse/crosshair look-ahead
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseLookAheadFactor = 0.18; // fraction of player→mouse offset added to target
    this.mouseLookAheadMax = 120;     // px cap

    // Room bounds (set via setBounds; null = unlimited)
    this.bounds = null; // { minX, minY, maxX, maxY } in world coords

    // EMA velocity smoothing (absorbs server corrections)
    this.smoothVelX = 0;
    this.smoothVelY = 0;
    this.velSmoothAlpha = 0.15;

    // Screen shake
    this.shakeOffset = { x: 0, y: 0 };
    this.shakeIntensity = 0;
    this.shakeRemaining = 0; // ms remaining — decay via deltaTime, no extra perf.now()

    // Zoom + device pixel ratio
    this.zoom = 1.0;
    this._dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

    // Screen-space conversion cache (invalidated each follow() call)
    this._cacheValid = false;
    this._cachedCamX = 0;
    this._cachedCamY = 0;
  }

  // ─── Internal: invalidate cache ───────────────────────────────────────────

  _invalidateCache(camX, camY) {
    this._cacheValid = true;
    this._cachedCamX = camX;
    this._cachedCamY = camY;
  }

  // ─── Follow ───────────────────────────────────────────────────────────────

  /**
   * Follow player with exponential lerp (frame-independent, deadzone, look-ahead).
   * @param {Object} player  - {x, y}
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {number} [deltaTime] - ms since last frame
   * @returns {{x: number, y: number}} final camera position (with shake)
   */
  follow(player, canvasWidth, canvasHeight, deltaTime = this.targetFrameTime) {
    deltaTime = Math.min(deltaTime, 100);

    // Look-ahead via EMA-smoothed velocity
    let lookAheadX = 0;
    let lookAheadY = 0;
    if (this.lookAheadEnabled) {
      const rawVX = player.x - this.lastPlayerX;
      const rawVY = player.y - this.lastPlayerY;
      this.smoothVelX += (rawVX - this.smoothVelX) * this.velSmoothAlpha;
      this.smoothVelY += (rawVY - this.smoothVelY) * this.velSmoothAlpha;
      const maxLA = 100;
      lookAheadX = Math.max(-maxLA, Math.min(maxLA, this.smoothVelX * this.lookAheadFactor * 10));
      lookAheadY = Math.max(-maxLA, Math.min(maxLA, this.smoothVelY * this.lookAheadFactor * 10));
    }
    this.lastPlayerX = player.x;
    this.lastPlayerY = player.y;

    // Mouse/crosshair look-ahead: shift camera slightly toward where player is aiming
    const mla = this.mouseLookAheadMax;
    const mlf = this.mouseLookAheadFactor;
    const mOffX = Math.max(-mla, Math.min(mla, (this.mouseX - canvasWidth / 2) * mlf));
    const mOffY = Math.max(-mla, Math.min(mla, (this.mouseY - canvasHeight / 2) * mlf));

    let targetX = player.x + lookAheadX + mOffX - canvasWidth / 2;
    let targetY = player.y + lookAheadY + mOffY - canvasHeight / 2;

    // Clamp target to room bounds so camera never shows outside the map
    if (this.bounds) {
      const { minX, minY, maxX, maxY } = this.bounds;
      targetX = Math.max(minX, Math.min(maxX - canvasWidth, targetX));
      targetY = Math.max(minY, Math.min(maxY - canvasHeight, targetY));
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distSq = dx * dx + dy * dy; // no Math.sqrt needed for deadzone

    if (distSq < this._deadZoneSq) {
      this.velocityX *= this.damping;
      this.velocityY *= this.damping;
    } else {
      // Exponential smooth: factor = 1 - e^(-speed * dt/1000)
      const t = 1 - Math.exp((-this.smoothingSpeed * deltaTime) / 1000);
      this.velocityX = dx * t;
      this.velocityY = dy * t;
    }

    this.x += this.velocityX;
    this.y += this.velocityY;
    this.width = canvasWidth;
    this.height = canvasHeight;

    this._updateShake(deltaTime);
    // Anti-jitter: round to integer pixels to prevent sub-pixel blur
    const camX = Math.round(this.x + this.shakeOffset.x);
    const camY = Math.round(this.y + this.shakeOffset.y);
    this._invalidateCache(camX, camY);

    return { x: camX, y: camY };
  }

  // ─── Recenter ─────────────────────────────────────────────────────────────

  recenter(player, canvasWidth, canvasHeight) {
    this.x = player.x - canvasWidth / 2;
    this.y = player.y - canvasHeight / 2;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastPlayerX = player.x;
    this.lastPlayerY = player.y;
    this.width = canvasWidth;
    this.height = canvasHeight;
    this._invalidateCache(this.x, this.y);
  }

  // ─── Shake ────────────────────────────────────────────────────────────────

  /**
   * Trigger screen shake.
   * @param {number} intensity - pixels
   * @param {number} duration  - ms
   */
  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeRemaining = duration;
  }

  /** @private — called inside follow(); decays via deltaTime, no extra perf.now() */
  _updateShake(deltaTime) {
    if (this.shakeIntensity <= 0 || this.shakeRemaining <= 0) {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
      return;
    }
    // Linear decay
    const progress = 1 - this.shakeRemaining / (this.shakeRemaining + deltaTime);
    const cur = this.shakeIntensity * (1 - progress);
    this.shakeOffset.x = (Math.random() - 0.5) * 2 * cur;
    this.shakeOffset.y = (Math.random() - 0.5) * 2 * cur;
    this.shakeRemaining = Math.max(0, this.shakeRemaining - deltaTime);
    if (this.shakeRemaining <= 0) {
      this.shakeIntensity = 0;
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }

  // ─── Viewport / culling ───────────────────────────────────────────────────

  /**
   * AABB viewport check — no Math.hypot, uses cached cam position.
   * @param {number} x
   * @param {number} y
   * @param {number} [margin=100]
   * @returns {boolean}
   */
  isInViewport(x, y, margin = 100) {
    const cx = this._cacheValid ? this._cachedCamX : this.x + this.shakeOffset.x;
    const cy = this._cacheValid ? this._cachedCamY : this.y + this.shakeOffset.y;
    return x + margin >= cx &&
           x - margin <= cx + this.width &&
           y + margin >= cy &&
           y - margin <= cy + this.height;
  }

  /**
   * Viewport bounds for bulk culling.
   * @param {number} [margin=0]
   */
  getViewportBounds(margin = 0) {
    const cx = this._cachedCamX;
    const cy = this._cachedCamY;
    return {
      left:   cx - margin,
      right:  cx + this.width + margin,
      top:    cy - margin,
      bottom: cy + this.height + margin
    };
  }

  // ─── Zoom + DPR ───────────────────────────────────────────────────────────

  /**
   * Set zoom level.
   * @param {number} z - zoom factor (1.0 = normal)
   */
  setZoom(z) {
    this.zoom = Math.max(0.1, z);
  }

  /**
   * Effective pixel ratio (DPR × zoom).
   * Use this as ctx.scale() factor instead of raw devicePixelRatio.
   */
  getPixelRatio() {
    return this._dpr * this.zoom;
  }

  // ─── Screen-space conversions (cached) ────────────────────────────────────

  /** World → screen pixel (uses cached cam, respects DPR). */
  worldToScreen(wx, wy) {
    const dpr = this._dpr;
    return {
      x: (wx - this._cachedCamX) * dpr,
      y: (wy - this._cachedCamY) * dpr
    };
  }

  /** Screen pixel → world coordinate. */
  screenToWorld(sx, sy) {
    const dpr = this._dpr;
    return {
      x: sx / dpr + this._cachedCamX,
      y: sy / dpr + this._cachedCamY
    };
  }

  // ─── Misc helpers ─────────────────────────────────────────────────────────

  getPosition() {
    return { x: this._cachedCamX, y: this._cachedCamY };
  }

  getRawPosition() {
    return { x: this.x, y: this.y };
  }

  /**
   * Set the world-space room bounds. Camera will be clamped inside.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX - room width in world px
   * @param {number} maxY - room height in world px
   */
  setBounds(minX, minY, maxX, maxY) {
    this.bounds = { minX, minY, maxX, maxY };
  }

  clearBounds() {
    this.bounds = null;
  }

  /**
   * Update the mouse/crosshair position in screen-space (call every frame from PlayerController).
   * @param {number} sx - screen x
   * @param {number} sy - screen y
   */
  setMouse(sx, sy) {
    this.mouseX = sx;
    this.mouseY = sy;
  }

  setSmoothingSpeed(speed) {
    this.smoothingSpeed = Math.max(1, Math.min(20, speed));
  }

  setLookAhead(enabled, factor = 0.15) {
    this.lookAheadEnabled = enabled;
    this.lookAheadFactor = Math.max(0, Math.min(1, factor));
  }

  setDeadZone(px) {
    this.deadZone = px;
    this._deadZoneSq = px * px;
  }
}

// Export to window
window.CameraManager = CameraManager;
