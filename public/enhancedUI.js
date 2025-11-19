/**
 * ENHANCED UI SYSTEM
 * Improved user interface with animations and mobile optimization
 * @version 1.0.0
 */

/* ============================================
   NOTIFICATION SYSTEM
   ============================================ */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.init();
  }

  /**
   * Initialise le conteneur de notifications
   */
  init() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Affiche une notification
   */
  show(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    const colors = {
      info: '#00aaff',
      success: '#00ff00',
      warning: '#ffaa00',
      error: '#ff0000',
      gold: '#ffd700'
    };

    notification.style.cssText = `
      background: rgba(0, 0, 0, 0.9);
      color: ${colors[type] || colors.info};
      padding: 15px 20px;
      margin-bottom: 10px;
      border-radius: 10px;
      border: 2px solid ${colors[type] || colors.info};
      font-weight: bold;
      animation: slideInRight 0.3s ease, ${duration > 0 ? `slideOutRight 0.3s ease ${duration - 300}ms forwards` : ''};
      box-shadow: 0 0 20px ${colors[type] || colors.info}40;
      pointer-events: auto;
    `;

    this.container.appendChild(notification);
    this.notifications.push(notification);

    if (duration > 0) {
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
        this.remove(notification);
      }, duration);
    }

    return notification;
  }

  /**
   * Supprime une notification
   */
  remove(notification) {
    const index = this.notifications.indexOf(notification);
    if (index > -1) {
      this.notifications.splice(index, 1);
    }
    if (notification.parentElement) {
      notification.remove();
    }
  }

  /**
   * Affiche une notification de gain d'or
   */
  showGoldGain(amount) {
    this.show(`+${amount} 💰`, 'gold', 2000);
  }

  /**
   * Affiche une notification de level up
   */
  showLevelUp(level) {
    this.show(`⬆️ LEVEL ${level}!`, 'success', 3000);
  }

  /**
   * Affiche une notification de nouvelle arme
   */
  showWeaponUnlock(weaponName) {
    this.show(`🔫 ${weaponName} débloqué!`, 'success', 3000);
  }

  /**
   * Affiche une notification de boss
   */
  showBossWarning() {
    this.show('👹 BOSS SPAWN!', 'error', 4000);
  }
}

/* ============================================
   PROGRESS BAR ANIMATIONS
   ============================================ */

class AnimatedProgressBar {
  constructor(element, fillElement) {
    this.element = element;
    this.fillElement = fillElement;
    this.currentValue = 0;
    this.targetValue = 0;
    this.animationSpeed = 0.1;
  }

  /**
   * Définit la valeur cible
   */
  setValue(value, max = 100) {
    this.targetValue = Math.max(0, Math.min(100, (value / max) * 100));
  }

  /**
   * Met à jour l'animation
   */
  update() {
    if (Math.abs(this.targetValue - this.currentValue) > 0.1) {
      this.currentValue += (this.targetValue - this.currentValue) * this.animationSpeed;
      this.fillElement.style.width = `${this.currentValue}%`;
    }
  }

  /**
   * Animation de pulsation (pour low health)
   */
  pulse(enabled) {
    if (enabled) {
      this.fillElement.style.animation = 'pulse 0.5s infinite';
    } else {
      this.fillElement.style.animation = '';
    }
  }
}

/* ============================================
   MOBILE UI ENHANCEMENTS
   ============================================ */

class EnhancedMobileUI {
  constructor() {
    this.joystickHaptic = false;
    this.buttonHaptic = true;
    this.init();
  }

  /**
   * Initialise les améliorations mobile
   */
  init() {
    this.enhanceJoystick();
    this.enhanceButtons();
    this.addHapticFeedback();
  }

  /**
   * Améliore le joystick avec des effets visuels
   */
  enhanceJoystick() {
    const joystickContainer = document.getElementById('joystick-container');
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');

    if (!joystickContainer || !joystickBase || !joystickStick) return;

    // Ajout d'un effet de glow
    joystickBase.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
    joystickStick.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.5)';

    // Animation au toucher
    (window.eventListenerManager ? window.eventListenerManager.add(joystickBase, 'touchstart', () : (window.eventListenerManager ? window.eventListenerManager.add(joystickBase, 'touchstart', ()) : joystickBase.addEventListener('touchstart', ())) => {
      joystickBase.style.transform = 'scale(1.05)';
      joystickBase.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.6)';
    });

    (window.eventListenerManager ? window.eventListenerManager.add(joystickBase, 'touchend', () : (window.eventListenerManager ? window.eventListenerManager.add(joystickBase, 'touchend', ()) : joystickBase.addEventListener('touchend', ())) => {
      joystickBase.style.transform = 'scale(1)';
      joystickBase.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
    });
  }

  /**
   * Améliore les boutons avec des animations
   */
  enhanceButtons() {
    const autoShootBtn = document.getElementById('auto-shoot-btn');
    if (!autoShootBtn) return;

    // Effet de pression
    (window.eventListenerManager ? window.eventListenerManager.add(autoShootBtn, 'touchstart', (e) : (window.eventListenerManager ? window.eventListenerManager.add(autoShootBtn, 'touchstart', (e)) : autoShootBtn.addEventListener('touchstart', (e))) => {
      e.preventDefault();
      autoShootBtn.style.transform = 'scale(0.95)';
      autoShootBtn.style.boxShadow = '0 0 30px rgba(255, 0, 0, 0.8)';
      this.vibrate(10);
    });

    (window.eventListenerManager ? window.eventListenerManager.add(autoShootBtn, 'touchend', (e) : (window.eventListenerManager ? window.eventListenerManager.add(autoShootBtn, 'touchend', (e)) : autoShootBtn.addEventListener('touchend', (e))) => {
      e.preventDefault();
      autoShootBtn.style.transform = 'scale(1)';
      autoShootBtn.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
    });
  }

  /**
   * Ajoute le retour haptique
   */
  addHapticFeedback() {
    // Vérifier si l'API de vibration est disponible
    if (!navigator.vibrate) {
      this.buttonHaptic = false;
    }
  }

  /**
   * Déclenche une vibration
   */
  vibrate(duration = 10) {
    if (this.buttonHaptic && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  /**
   * Feedback haptique pour un tir
   */
  shootFeedback() {
    this.vibrate(5);
  }

  /**
   * Feedback haptique pour un impact
   */
  hitFeedback() {
    this.vibrate(10);
  }

  /**
   * Feedback haptique pour un damage
   */
  damageFeedback() {
    this.vibrate([50, 30, 50]);
  }

  /**
   * Feedback haptique pour level up
   */
  levelUpFeedback() {
    this.vibrate([100, 50, 100, 50, 100]);
  }
}

/* ============================================
   SCREEN EFFECTS
   ============================================ */

class ScreenEffects {
  constructor() {
    this.overlay = null;
    this.init();
  }

  /**
   * Initialise l'overlay d'effets
   */
  init() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'screen-effects-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Effet de flash (dégâts, heal, etc.)
   */
  flash(color, duration = 200) {
    this.overlay.style.backgroundColor = color;
    this.overlay.style.opacity = '0.4';

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.overlay.style.transition = `opacity ${duration}ms ease`;
      this.overlay.style.opacity = '0';
    }, 50);

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.overlay.style.transition = '';
      this.overlay.style.backgroundColor = 'transparent';
    }, duration + 50);
  }

  /**
   * Flash de dégâts (rouge)
   */
  damageFlash() {
    this.flash('rgba(255, 0, 0, 0.8)', 300);
  }

  /**
   * Flash de heal (vert)
   */
  healFlash() {
    this.flash('rgba(0, 255, 0, 0.6)', 300);
  }

  /**
   * Flash de level up (doré)
   */
  levelUpFlash() {
    this.flash('rgba(255, 215, 0, 0.5)', 500);
  }

  /**
   * Vignette (effet de bords sombres quand low health)
   */
  vignette(intensity = 0) {
    if (intensity > 0) {
      const gradient = `radial-gradient(circle at center, transparent 0%, rgba(255, 0, 0, ${intensity * 0.3}) 100%)`;
      this.overlay.style.background = gradient;
    } else {
      this.overlay.style.background = 'transparent';
    }
  }
}

/* ============================================
   FLOATING TEXT
   ============================================ */

class FloatingTextManager {
  constructor() {
    this.texts = [];
    this.container = null;
    this.init();
  }

  /**
   * Initialise le conteneur
   */
  init() {
    this.container = document.createElement('div');
    this.container.id = 'floating-text-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 500;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Crée un texte flottant
   */
  create(text, x, y, color = '#ffffff', size = 20) {
    const element = document.createElement('div');
    element.textContent = text;
    element.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      color: ${color};
      font-size: ${size}px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      animation: floatUp 1s ease forwards;
      pointer-events: none;
    `;

    this.container.appendChild(element);
    this.texts.push(element);

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      element.remove();
      const index = this.texts.indexOf(element);
      if (index > -1) this.texts.splice(index, 1);
    }, 1000);
  }

  /**
   * Crée un nombre de dégâts
   */
  createDamage(x, y, damage, isCritical = false) {
    const color = isCritical ? '#ff0000' : '#ffffff';
    const size = isCritical ? 28 : 20;
    const text = `-${Math.round(damage)}`;
    this.create(text, x, y, color, size);
  }

  /**
   * Crée un nombre de heal
   */
  createHeal(x, y, amount) {
    this.create(`+${Math.round(amount)}`, x, y, '#00ff00', 20);
  }
}

/* ============================================
   ENHANCED UI MANAGER
   ============================================ */

class EnhancedUIManager {
  constructor() {
    this.notifications = new NotificationSystem();
    this.mobileUI = null;
    this.screenEffects = new ScreenEffects();
    this.floatingText = new FloatingTextManager();
    this.progressBars = {};

    this.init();
  }

  /**
   * Initialise le système
   */
  init() {
    // Détection mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      this.mobileUI = new EnhancedMobileUI();
    }

    this.setupProgressBars();
    this.addCSSAnimations();
    this.enhanceExistingUI();
  }

  /**
   * Configure les barres de progression animées
   */
  setupProgressBars() {
    const healthBar = document.getElementById('health-fill');
    const xpBar = document.getElementById('xp-fill');

    if (healthBar) {
      this.progressBars.health = new AnimatedProgressBar(
        document.getElementById('health-bar'),
        healthBar
      );
    }

    if (xpBar) {
      this.progressBars.xp = new AnimatedProgressBar(
        document.getElementById('xp-bar'),
        xpBar
      );
    }
  }

  /**
   * Ajoute les animations CSS
   */
  addCSSAnimations() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }

      @keyframes floatUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-50px);
          opacity: 0;
        }
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
        }
      }

      @keyframes glow {
        0%, 100% {
          box-shadow: 0 0 10px currentColor;
        }
        50% {
          box-shadow: 0 0 20px currentColor, 0 0 30px currentColor;
        }
      }

      /* Amélioration des boutons */
      button {
        transition: all 0.2s ease;
      }

      button:hover {
        transform: scale(1.05);
        filter: brightness(1.2);
      }

      button:active {
        transform: scale(0.95);
      }

      /* Amélioration des stats */
      #stats > div {
        transition: all 0.3s ease;
      }

      #stats > div:hover {
        transform: scale(1.02);
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Améliore l'UI existante
   */
  enhanceExistingUI() {
    // Ajouter des transitions fluides aux éléments existants
    const elements = [
      'health-container',
      'xp-container',
      'score',
      'wave',
      'weapon'
    ];

    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.transition = 'all 0.3s ease';
      }
    });
  }

  /**
   * Met à jour les barres de progression
   */
  updateProgressBar(type, value, max) {
    if (this.progressBars[type]) {
      this.progressBars[type].setValue(value, max);
      this.progressBars[type].update();

      // Pulse si health est bas
      if (type === 'health' && value / max < 0.3) {
        this.progressBars[type].pulse(true);
        this.screenEffects.vignette(1 - (value / max));
      } else if (type === 'health') {
        this.progressBars[type].pulse(false);
        this.screenEffects.vignette(0);
      }
    }
  }

  /**
   * Feedback lors d'un événement
   */
  onPlayerShoot() {
    if (this.mobileUI) {
      this.mobileUI.shootFeedback();
    }
  }

  onPlayerHit() {
    if (this.mobileUI) {
      this.mobileUI.hitFeedback();
    }
  }

  onPlayerDamage() {
    this.screenEffects.damageFlash();
    if (this.mobileUI) {
      this.mobileUI.damageFeedback();
    }
  }

  onPlayerHeal(amount) {
    this.screenEffects.healFlash();
    this.notifications.show(`+${amount} ❤️`, 'success', 2000);
  }

  onLevelUp(level) {
    this.screenEffects.levelUpFlash();
    this.notifications.showLevelUp(level);
    if (this.mobileUI) {
      this.mobileUI.levelUpFeedback();
    }
  }

  onGoldCollect(amount) {
    this.notifications.showGoldGain(amount);
  }

  onBossSpawn() {
    this.notifications.showBossWarning();
    if (this.mobileUI) {
      this.mobileUI.vibrate([100, 50, 100]);
    }
  }

  /**
   * Boucle de mise à jour
   */
  update() {
    // Met à jour les barres de progression
    Object.values(this.progressBars).forEach(bar => bar.update());
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.EnhancedUIManager = EnhancedUIManager;
  window.NotificationSystem = NotificationSystem;
  window.ScreenEffects = ScreenEffects;
  window.FloatingTextManager = FloatingTextManager;
}
