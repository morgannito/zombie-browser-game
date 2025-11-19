/**
 * INPUT MANAGER
 * Handles keyboard and mouse input for player controls
 * @module InputManager
 * @author Claude Code
 * @version 2.0.0
 */

class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.mobileControls = null;

    // Store handler references for cleanup
    this.handlers = {
      keydown: (e) => this.handleKeyDown(e),
      keyup: (e) => this.handleKeyUp(e)
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', this.handlers.keydown);
    window.addEventListener('keyup', this.handlers.keyup);
  }

  cleanup() {
    // Remove keyboard event listeners
    window.removeEventListener('keydown', this.handlers.keydown);
    window.removeEventListener('keyup', this.handlers.keyup);
  }

  handleKeyDown(e) {
    this.keys[e.key.toLowerCase()] = true;

    // TAB key for stats panel
    if (e.key === 'Tab') {
      e.preventDefault();
      if (window.gameUI) {
        window.gameUI.toggleStatsPanel();
      }
    }
  }

  handleKeyUp(e) {
    this.keys[e.key.toLowerCase()] = false;
  }

  updateMouse(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  isKeyPressed(key) {
    return this.keys[key] === true;
  }

  setMobileControls(mobileControls) {
    this.mobileControls = mobileControls;
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;

    // Mobile joystick input (takes priority)
    if (this.mobileControls && this.mobileControls.isActive()) {
      const joystickVector = this.mobileControls.getJoystickVector();
      dx = joystickVector.dx;
      dy = joystickVector.dy;
    } else {
      // WASD or Arrow keys
      if (this.isKeyPressed('w') || this.isKeyPressed('arrowup') || this.isKeyPressed('z')) dy -= 1;
      if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) dy += 1;
      if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft') || this.isKeyPressed('q')) dx -= 1;
      if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) dx += 1;

      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }
    }

    return { dx, dy };
  }
}

// Export to window
window.InputManager = InputManager;
