/**
 * MOBILE CONTROLS MANAGER
 * Handles mobile-specific controls (joystick, auto-shoot, gestures)
 * @module MobileControlsManager
 * @author Claude Code
 * @version 2.0.0
 */

class MobileControlsManager {
  constructor() {
    this.isMobile = this.detectMobile();
    this.joystickActive = false;
    this.joystickVector = { dx: 0, dy: 0 };
    this.autoShootActive = false;
    this.autoShootInterval = null;
    this.lastAutoShootTime = 0;
    this.currentTarget = null; // Store current auto-shoot target

    // Gesture detection properties
    this.lastTapTime = 0;
    this.tapCount = 0;
    this.longPressTimer = null;
    this.swipeStartX = 0;
    this.swipeStartY = 0;
    this.swipeStartTime = 0;

    // Store handlers and elements for cleanup
    this.handlers = {};
    this.elements = {};

    if (this.isMobile) {
      this.showMobileControls();
      this.setupJoystick();
      this.setupAutoShoot();
      this.setupAdvancedGestures();
    }
  }

  detectMobile() {
    // Check for touch support and screen size
    const isTouchDevice = ('ontouchstart' in window) ||
                         (navigator.maxTouchPoints > 0) ||
                         (navigator.msMaxTouchPoints > 0);
    const isSmallScreen = window.innerWidth <= 768;
    return isTouchDevice && isSmallScreen;
  }

  showMobileControls() {
    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls) {
      mobileControls.style.display = 'block';
    } else {
      console.warn('Mobile controls: Container element not found');
    }

    // Hide instructions on mobile
    const instructions = document.getElementById('instructions');
    if (instructions) {
      instructions.style.display = 'none';
    }
  }

  setupJoystick() {
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');

    if (!joystickBase || !joystickStick) {
      console.warn('Mobile controls: Joystick elements not found');
      return;
    }

    this.elements.joystickBase = joystickBase;
    this.elements.joystickStick = joystickStick;

    let touchId = null;
    const maxDistance = 45; // Maximum distance the stick can move from center

    const handleTouchStart = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchId = touch.identifier;
      this.joystickActive = true;
      joystickBase.classList.add('active');
      joystickStick.classList.add('active');
      this.updateJoystickPosition(touch, joystickBase, joystickStick, maxDistance);
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (!this.joystickActive) {
        return;
      }

      const touch = Array.from(e.touches).find(t => t.identifier === touchId);
      if (touch) {
        this.updateJoystickPosition(touch, joystickBase, joystickStick, maxDistance);
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      this.joystickActive = false;
      this.joystickVector = { dx: 0, dy: 0 };
      joystickBase.classList.remove('active');
      joystickStick.classList.remove('active');

      // Reset stick position
      joystickStick.style.transform = 'translate(-50%, -50%)';
    };

    // Store handlers for cleanup
    this.handlers.joystickStart = handleTouchStart;
    this.handlers.joystickMove = handleTouchMove;
    this.handlers.joystickEnd = handleTouchEnd;

    joystickBase.addEventListener('touchstart', handleTouchStart, { passive: false });
    joystickBase.addEventListener('touchmove', handleTouchMove, { passive: false });
    joystickBase.addEventListener('touchend', handleTouchEnd, { passive: false });
    joystickBase.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  updateJoystickPosition(touch, base, stick, maxDistance) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;

    // Calculate distance from center
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Limit to max distance
    if (distance > maxDistance) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxDistance;
      dy = Math.sin(angle) * maxDistance;
    }

    // Update stick visual position
    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalize vector for movement (-1 to 1)
    this.joystickVector = {
      dx: dx / maxDistance,
      dy: dy / maxDistance
    };
  }

  setupAutoShoot() {
    const autoShootBtn = document.getElementById('auto-shoot-btn');
    if (!autoShootBtn) {
      console.warn('Mobile controls: Auto-shoot button not found');
      return;
    }

    this.elements.autoShootBtn = autoShootBtn;

    const handleAutoShoot = (e) => {
      e.preventDefault();
      this.toggleAutoShoot();
    };

    this.handlers.autoShoot = handleAutoShoot;
    autoShootBtn.addEventListener('touchstart', handleAutoShoot);
  }

  toggleAutoShoot() {
    this.autoShootActive = !this.autoShootActive;
    const autoShootBtn = document.getElementById('auto-shoot-btn');

    if (this.autoShootActive) {
      autoShootBtn.classList.add('active');
      this.startAutoShoot();
      if (window.audioManager) {
        window.audioManager.play('click');
      }
    } else {
      autoShootBtn.classList.remove('active');
      this.stopAutoShoot();
      if (window.audioManager) {
        window.audioManager.play('click');
      }
    }
  }

  startAutoShoot() {
    // Initialize auto-shoot timestamp
    this.lastAutoShootTime = 0;
  }

  stopAutoShoot() {
    this.currentTarget = null; // Clear target when stopping
    this.lastAutoShootTime = 0;
  }

  /**
   * Update auto-shoot logic (called from main game loop)
   * @param {number} currentTime - Current timestamp in ms
   */
  updateAutoShoot(currentTime) {
    if (!this.autoShootActive) {
      return;
    }

    // Check if enough time has passed since last shot
    if (currentTime - this.lastAutoShootTime < CONSTANTS.MOBILE.AUTO_SHOOT_INTERVAL) {
      return;
    }

    // Verify all required objects exist
    if (!window.gameState || !window.networkManager || !window.playerController) {
      return;
    }

    const player = window.gameState.getPlayer();
    if (!player || !player.alive || !window.playerController.gameStarted) {
      return;
    }

    // Find nearest zombie and shoot at it
    const nearestZombie = this.findNearestZombie(player);
    this.currentTarget = nearestZombie; // Store for visual indicator

    if (nearestZombie) {
      const angle = Math.atan2(
        nearestZombie.y - player.y,
        nearestZombie.x - player.x
      );
      // Mettre à jour l'angle visuel du canon
      player.angle = angle;
      window.networkManager.shoot(angle);

      // Update last shot time
      this.lastAutoShootTime = currentTime;
    }
  }

  getCurrentTarget() {
    return this.currentTarget;
  }

  findNearestZombie(player) {
    if (!window.gameState || !window.gameState.state || !window.gameState.state.zombies) {
      return null;
    }

    const zombies = Object.values(window.gameState.state.zombies);
    if (zombies.length === 0) {
      return null;
    }

    let nearestZombie = null;
    let minScore = Infinity;

    zombies.forEach(zombie => {
      const dx = zombie.x - player.x;
      const dy = zombie.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate angle to zombie
      const angleToZombie = Math.atan2(dy, dx);
      const playerAngle = player.angle || 0;

      // Calculate angle difference (normalized to -π to π)
      let angleDiff = angleToZombie - playerAngle;
      while (angleDiff > Math.PI) {
        angleDiff -= 2 * Math.PI;
      }
      while (angleDiff < -Math.PI) {
        angleDiff += 2 * Math.PI;
      }

      // Aim assist: prefer zombies in front of player
      // Score = distance * angle_penalty
      // Zombies directly in front have angle_penalty = 1
      // Zombies behind have angle_penalty > 2
      const anglePenalty = 1 + Math.abs(angleDiff) / Math.PI;

      // Boss zombies get priority (lower score)
      const bossPriority = zombie.isBoss ? 0.5 : 1;

      const score = distance * anglePenalty * bossPriority;

      if (score < minScore) {
        minScore = score;
        nearestZombie = zombie;
      }
    });

    return nearestZombie;
  }

  isActive() {
    return this.joystickActive;
  }

  getJoystickVector() {
    return this.joystickVector;
  }

  setupAdvancedGestures() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      return;
    }

    this.elements.canvas = canvas;

    // Swipe detection for pause menu (from edge)
    const handleGestureTouchStart = (e) => {
      const touch = e.touches[0];
      this.swipeStartX = touch.clientX;
      this.swipeStartY = touch.clientY;
      this.swipeStartTime = Date.now();

      // Long press detection
      this.longPressTimer = setTimeout(() => {
        this.handleLongPress(touch.clientX, touch.clientY);
      }, 500);
    };

    const handleGestureTouchMove = (e) => {
      // Cancel long press if moved
      if (this.longPressTimer) {
        const touch = e.touches[0];
        const dx = touch.clientX - this.swipeStartX;
        const dy = touch.clientY - this.swipeStartY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
    };

    const handleGestureTouchEnd = (e) => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      if (e.changedTouches.length === 0) {
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.swipeStartX;
      const _dy = touch.clientY - this.swipeStartY;
      const dt = Date.now() - this.swipeStartTime;

      // Swipe detection (fast movement)
      if (dt < 300 && Math.abs(dx) > 100) {
        this.handleSwipe(dx > 0 ? 'right' : 'left');
      }
    };

    // Store handlers for cleanup
    this.handlers.gestureTouchStart = handleGestureTouchStart;
    this.handlers.gestureTouchMove = handleGestureTouchMove;
    this.handlers.gestureTouchEnd = handleGestureTouchEnd;

    canvas.addEventListener('touchstart', handleGestureTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleGestureTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleGestureTouchEnd, { passive: true });

    // Double-tap on auto-shoot for burst mode
    const autoShootBtn = this.elements.autoShootBtn || document.getElementById('auto-shoot-btn');
    if (autoShootBtn) {
      const handleDoubleTapDetect = (_e) => {
        const now = Date.now();
        if (now - this.lastTapTime < 300) {
          this.tapCount++;
          if (this.tapCount === 2) {
            this.handleDoubleTap();
            this.tapCount = 0;
          }
        } else {
          this.tapCount = 1;
        }
        this.lastTapTime = now;
      };

      this.handlers.doubleTapDetect = handleDoubleTapDetect;
      autoShootBtn.addEventListener('touchend', handleDoubleTapDetect, { passive: true });
    }
  }

  handleDoubleTap() {
    // Visual feedback for double-tap
    // Could enable burst mode here
    if (window.audioManager) {
      window.audioManager.play('doubleClick');
    }
  }

  handleLongPress(_x, _y) {
    // Long press detected
    if (window.audioManager) {
      window.audioManager.play('longPress');
    }
    // Could trigger special ability or boost
  }

  handleSwipe(direction) {
    // Swipe detected
    if (direction === 'right' && this.swipeStartX < CONSTANTS.MOBILE.GESTURE_THRESHOLD) {
      // Swipe from left edge - could open menu
      if (window.audioManager) {
        window.audioManager.play('swipe');
      }
    }
  }

  cleanup() {
    // Stop auto-shoot interval
    this.stopAutoShoot();

    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Remove joystick event listeners
    if (this.elements.joystickBase && this.handlers.joystickStart) {
      this.elements.joystickBase.removeEventListener('touchstart', this.handlers.joystickStart);
      this.elements.joystickBase.removeEventListener('touchmove', this.handlers.joystickMove);
      this.elements.joystickBase.removeEventListener('touchend', this.handlers.joystickEnd);
      this.elements.joystickBase.removeEventListener('touchcancel', this.handlers.joystickEnd);
    }

    // Remove auto-shoot event listener
    if (this.elements.autoShootBtn && this.handlers.autoShoot) {
      this.elements.autoShootBtn.removeEventListener('touchstart', this.handlers.autoShoot);
    }

    // Remove gesture event listeners
    if (this.elements.canvas) {
      if (this.handlers.gestureTouchStart) {
        this.elements.canvas.removeEventListener('touchstart', this.handlers.gestureTouchStart);
      }
      if (this.handlers.gestureTouchMove) {
        this.elements.canvas.removeEventListener('touchmove', this.handlers.gestureTouchMove);
      }
      if (this.handlers.gestureTouchEnd) {
        this.elements.canvas.removeEventListener('touchend', this.handlers.gestureTouchEnd);
      }
    }

    // Remove double-tap listener
    if (this.elements.autoShootBtn && this.handlers.doubleTapDetect) {
      this.elements.autoShootBtn.removeEventListener('touchend', this.handlers.doubleTapDetect);
    }

    // Clear references
    this.handlers = {};
    this.elements = {};
  }
}

// Export to window
window.MobileControlsManager = MobileControlsManager;
