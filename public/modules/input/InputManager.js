/**
 * INPUT MANAGER
 * Handles keyboard, mouse, and gamepad input for player controls
 * Optimized for minimal input lag with RAF-based polling
 * @module InputManager
 * @author Claude Code
 * @version 4.0.0
 */

// Keys that must suppress browser default behaviour during gameplay.
const GAMEPLAY_PREVENT_KEYS = new Set([
  'tab',
  ' ',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright'
]);

class InputManager {
  constructor() {
    this.keys = {};
    this.keysJustPressed = {}; // Track keys pressed this frame
    this.mouse = { x: 0, y: 0, deltaX: 0, deltaY: 0 };
    this.mobileControls = null;

    // Input buffering for network reconciliation
    this.inputBuffer = [];
    this.inputSequence = 0;
    this.maxBufferSize = 64; // Keep last 64 inputs for reconciliation

    // Cached movement vector — invariant: cachedMovement is authoritative whenever
    // movementDirty === false. Any code that changes keys, gamepad state, or
    // mobileControls MUST set movementDirty = true so the next getMovementVector()
    // call recomputes. Never clear movementDirty without also updating cachedMovement.
    this.cachedMovement = { dx: 0, dy: 0, magnitude: 0 };
    this.movementDirty = true;

    // Performance: Track last input time for idle detection
    this.lastInputTime = performance.now();
    this.isIdle = false;
    this.idleThreshold = 100; // Consider idle after 100ms of no input

    // Store handler references for cleanup
    this.handlers = {
      keydown: e => this.handleKeyDown(e),
      keyup: e => this.handleKeyUp(e),
      blur: () => this.handleBlur(),
      visibilitychange: () => this.handleVisibilityChange()
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Keyboard events with capture phase for faster response
    window.addEventListener('keydown', this.handlers.keydown, { capture: true });
    window.addEventListener('keyup', this.handlers.keyup, { capture: true });

    // Handle window blur (release all keys to prevent stuck keys)
    window.addEventListener('blur', this.handlers.blur);
    document.addEventListener('visibilitychange', this.handlers.visibilitychange);
  }

  cleanup() {
    window.removeEventListener('keydown', this.handlers.keydown, { capture: true });
    window.removeEventListener('keyup', this.handlers.keyup, { capture: true });
    window.removeEventListener('blur', this.handlers.blur);
    document.removeEventListener('visibilitychange', this.handlers.visibilitychange);

    // Clear buffers
    this.inputBuffer = [];
    this.keys = {};
    this.keysJustPressed = {};
  }

  /**
   * Returns true when the focused element is a text input — key events there
   * should be ignored so the player can type without moving the character.
   */
  _isInputFocused() {
    const el = document.activeElement;
    if (!el) {
      return false;
    }
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  handleKeyDown(e) {
    // Do not intercept keys while the user is typing in a form field.
    if (this._isInputFocused()) {
      return;
    }

    const key = e.key.toLowerCase();

    // Suppress browser scroll/tab behaviour for gameplay keys.
    if (GAMEPLAY_PREVENT_KEYS.has(key)) {
      e.preventDefault();
    }

    // Track if this is a new press (not a repeat)
    if (!this.keys[key]) {
      this.keysJustPressed[key] = true;
      this.lastInputTime = performance.now();
      this.isIdle = false;
    }

    this.keys[key] = true;
    this.movementDirty = true;

    // TAB key for stats panel (already prevented above)
    if (e.key === 'Tab' && window.gameUI) {
      window.gameUI.toggleStatsPanel();
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys[key] = false;
    this.movementDirty = true;
    this.lastInputTime = performance.now();
    this.isIdle = false;
  }

  handleBlur() {
    // Release all keys when window loses focus
    this.keys = {};
    this.keysJustPressed = {};
    this.movementDirty = true;
    // BUGFIX: PlayerController retains its own velocity vector. Without
    // this, the player drifts for several frames after focus loss because
    // velocity decays at 0.8/frame instead of snapping to 0.
    if (window.playerController && window.playerController.velocity) {
      window.playerController.velocity.x = 0;
      window.playerController.velocity.y = 0;
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.handleBlur();
    }
  }

  updateMouse(x, y) {
    // Track delta for smoothing
    this.mouse.deltaX = x - this.mouse.x;
    this.mouse.deltaY = y - this.mouse.y;
    this.mouse.x = x;
    this.mouse.y = y;
    this.lastInputTime = performance.now();
    this.isIdle = false;
  }

  isKeyPressed(key) {
    return this.keys[key] === true;
  }

  /**
   * Check if key was just pressed this frame (for single-press actions)
   */
  isKeyJustPressed(key) {
    return this.keysJustPressed[key] === true;
  }

  /**
   * Clear just-pressed state (call at end of frame)
   */
  clearJustPressed() {
    this.keysJustPressed = {};
  }

  setMobileControls(mobileControls) {
    this.mobileControls = mobileControls;
  }

  /**
   * Update idle state (call each frame)
   */
  updateIdleState() {
    const now = performance.now();
    this.isIdle = now - this.lastInputTime > this.idleThreshold;
  }

  /**
   * Poll connected gamepads and merge their left-stick input into the current
   * keyboard state. Call this once per game loop frame before getMovementVector().
   *
   * Behaviour when no gamepad is connected is a no-op — identical to the
   * pre-gamepad code path.
   */
  updateGamepad() {
    if (!navigator.getGamepads) {
      return;
    }

    const gamepads = navigator.getGamepads();
    let gpDx = 0;
    let gpDy = 0;

    for (const gp of gamepads) {
      if (!gp || !gp.connected) {
        continue;
      }
      // Standard mapping: axes[0] = left stick X, axes[1] = left stick Y
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      // Dead-zone: ignore stick drift below 0.15
      if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
        gpDx = ax;
        gpDy = ay;
      }
      break; // Use first connected gamepad only
    }

    // Only mark dirty when gamepad state actually changes to avoid dropping cache.
    if (gpDx !== this._gpDx || gpDy !== this._gpDy) {
      this._gpDx = gpDx;
      this._gpDy = gpDy;
      this.movementDirty = true;
    }
  }

  /**
   * Get movement vector with caching for performance.
   *
   * Cache invariant: cachedMovement is returned unchanged as long as
   * movementDirty === false. movementDirty is set to true by handleKeyDown,
   * handleKeyUp, handleBlur, and updateGamepad whenever state changes.
   *
   * @returns {{dx: number, dy: number, magnitude: number}}
   */
  getMovementVector() {
    // Return cached value if movement state is unchanged since last call.
    if (!this.movementDirty) {
      return this.cachedMovement;
    }

    let dx = 0;
    let dy = 0;

    // Mobile joystick input (takes priority over all other sources)
    if (this.mobileControls && this.mobileControls.isActive()) {
      const joystickVector = this.mobileControls.getJoystickVector();
      dx = joystickVector.dx;
      dy = joystickVector.dy;
    } else {
      // WASD or Arrow keys (ZQSD for AZERTY)
      if (this.isKeyPressed('w') || this.isKeyPressed('arrowup') || this.isKeyPressed('z')) {
        dy -= 1;
      }
      if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) {
        dy += 1;
      }
      if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft') || this.isKeyPressed('q')) {
        dx -= 1;
      }
      if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) {
        dx += 1;
      }

      // Normalize diagonal movement using fast inverse sqrt approximation
      if (dx !== 0 && dy !== 0) {
        const invLen = 0.7071067811865476; // 1/sqrt(2)
        dx *= invLen;
        dy *= invLen;
      }

      // Merge gamepad left-stick — max magnitude wins so keyboard never
      // loses to a drifting stick and vice-versa.
      const gpDx = this._gpDx ?? 0;
      const gpDy = this._gpDy ?? 0;
      const kbMag = Math.sqrt(dx * dx + dy * dy);
      const gpMag = Math.sqrt(gpDx * gpDx + gpDy * gpDy);
      if (gpMag > kbMag) {
        dx = gpDx;
        dy = gpDy;
      }
    }

    // Calculate magnitude for speed calculations
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    // Cache the result and mark clean.
    this.cachedMovement = { dx, dy, magnitude };
    this.movementDirty = false;

    return this.cachedMovement;
  }

  /**
   * Record input for network reconciliation
   * @param {number} x - Player X position after input
   * @param {number} y - Player Y position after input
   * @param {number} angle - Player angle
   * @param {number} deltaTime - Time delta for this input
   * @returns {number} Input sequence number
   */
  recordInput(x, y, angle, deltaTime) {
    const input = {
      sequence: ++this.inputSequence,
      timestamp: performance.now(),
      x,
      y,
      angle,
      deltaTime,
      movement: { ...this.cachedMovement }
    };

    this.inputBuffer.push(input);

    // Trim buffer if too large
    while (this.inputBuffer.length > this.maxBufferSize) {
      this.inputBuffer.shift();
    }

    return input.sequence;
  }

  /**
   * Get inputs after a specific sequence number (for reconciliation)
   * @param {number} afterSequence - Get inputs after this sequence
   * @returns {Array} Array of inputs
   */
  getInputsAfter(afterSequence) {
    return this.inputBuffer.filter(input => input.sequence > afterSequence);
  }

  /**
   * Clear inputs up to a sequence number (after server acknowledgment)
   * @param {number} upToSequence - Clear inputs up to this sequence
   */
  clearInputsUpTo(upToSequence) {
    this.inputBuffer = this.inputBuffer.filter(input => input.sequence > upToSequence);
  }

  /**
   * Get the last recorded input
   * @returns {Object|null} Last input or null
   */
  getLastInput() {
    return this.inputBuffer.length > 0 ? this.inputBuffer[this.inputBuffer.length - 1] : null;
  }
}

// Export to window
window.InputManager = InputManager;
