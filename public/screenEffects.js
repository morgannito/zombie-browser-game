/**
 * SCREEN EFFECTS SYSTEM
 * Visual effects: flash, shake, slow motion, trails
 * @version 1.0.0
 */

/* ============================================
   SCREEN FLASH EFFECT
   ============================================ */

class ScreenFlash {
  constructor() {
    this.overlay = null;
    this.init();
  }

  /**
   * Initialise l'overlay de flash
   */
  init() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'screen-flash-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.1s ease;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Flash rouge quand le joueur prend des dégâts
   * @param {number} intensity - Intensité du flash (0-1)
   */
  flashDamage(intensity = 0.3) {
    if (!this.overlay) return;

    // Clamp intensity entre 0 et 1
    intensity = Math.max(0, Math.min(1, intensity));

    // Flash rouge
    this.overlay.style.background = `radial-gradient(circle, rgba(255,0,0,${intensity * 0.3}) 0%, rgba(255,0,0,${intensity * 0.6}) 100%)`;
    this.overlay.style.opacity = '1';

    // Fade out rapide
    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.overlay.style.opacity = '0';
    }, 50);
  }

  /**
   * Flash blanc pour critique ou explosion
   * @param {number} intensity - Intensité du flash (0-1)
   */
  flashWhite(intensity = 0.5) {
    if (!this.overlay) return;

    intensity = Math.max(0, Math.min(1, intensity));

    this.overlay.style.background = `rgba(255, 255, 255, ${intensity})`;
    this.overlay.style.opacity = '1';

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.overlay.style.opacity = '0';
    }, 80);
  }

  /**
   * Flash vert pour heal
   * @param {number} intensity - Intensité du flash (0-1)
   */
  flashHeal(intensity = 0.2) {
    if (!this.overlay) return;

    intensity = Math.max(0, Math.min(1, intensity));

    this.overlay.style.background = `radial-gradient(circle, rgba(0,255,0,${intensity * 0.2}) 0%, rgba(0,255,0,${intensity * 0.4}) 100%)`;
    this.overlay.style.opacity = '1';

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.overlay.style.opacity = '0';
    }, 100);
  }
}

/* ============================================
   SCREEN SHAKE EFFECT
   ============================================ */

class ScreenShake {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.isShaking = false;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.originalTransform = '';
    this.shakeStartTime = 0;
    this.shakeElapsed = 0;
  }

  /**
   * Déclenche une secousse d'écran
   * @param {number} intensity - Intensité de la secousse (pixels)
   * @param {number} duration - Durée en ms
   */
  shake(intensity = 10, duration = 300) {
    if (!this.canvas) return;

    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeElapsed = 0;

    if (!this.isShaking) {
      this.isShaking = true;
      this.originalTransform = this.canvas.style.transform || '';
    }
  }

  /**
   * Met à jour l'animation de la secousse (appelé depuis la boucle principale)
   * @param {number} deltaTime - Temps écoulé depuis la dernière frame en ms
   */
  update(deltaTime = 16) {
    if (!this.isShaking) return;

    this.shakeElapsed += deltaTime;
    const progress = this.shakeElapsed / this.shakeDuration;

    if (progress >= 1) {
      // Fin de la secousse
      this.isShaking = false;
      this.canvas.style.transform = this.originalTransform;
      return;
    }

    // Diminution progressive de l'intensité
    const currentIntensity = this.shakeIntensity * (1 - progress);

    // Offset aléatoire
    const offsetX = (Math.random() - 0.5) * currentIntensity * 2;
    const offsetY = (Math.random() - 0.5) * currentIntensity * 2;

    this.canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) ${this.originalTransform}`;
  }

  /**
   * Secousse légère (hit normal)
   */
  shakeLight() {
    this.shake(3, 150);
  }

  /**
   * Secousse moyenne (critique, explosion)
   */
  shakeMedium() {
    this.shake(8, 300);
  }

  /**
   * Secousse forte (mort du boss)
   */
  shakeHeavy() {
    this.shake(15, 500);
  }
}

/* ============================================
   SLOW MOTION EFFECT
   ============================================ */

class SlowMotionEffect {
  constructor() {
    this.isActive = false;
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;
    this.callbacks = [];
  }

  /**
   * Active le slow motion
   * @param {number} timeScale - Échelle de temps (0.1 = 10% vitesse)
   * @param {number} duration - Durée en ms
   */
  activate(timeScale = 0.3, duration = 500) {
    this.isActive = true;
    this.targetTimeScale = timeScale;
    this.timeScale = timeScale;

    // Notifier tous les callbacks
    this.notifyCallbacks();

    // Désactiver après la durée
    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      this.deactivate();
    }, duration);
  }

  /**
   * Désactive le slow motion
   */
  deactivate() {
    this.isActive = false;
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;
    this.notifyCallbacks();
  }

  /**
   * Obtient l'échelle de temps actuelle
   * @returns {number}
   */
  getTimeScale() {
    return this.timeScale;
  }

  /**
   * Vérifie si le slow motion est actif
   * @returns {boolean}
   */
  isSlowMotion() {
    return this.isActive;
  }

  /**
   * Enregistre un callback pour les changements de vitesse
   * @param {Function} callback
   */
  onTimeScaleChange(callback) {
    this.callbacks.push(callback);
  }

  /**
   * Notifie tous les callbacks
   */
  notifyCallbacks() {
    this.callbacks.forEach(cb => cb(this.timeScale));
  }

  /**
   * Slow motion pour mort du boss
   */
  bossDeath() {
    this.activate(0.2, 800);
  }

  /**
   * Slow motion pour critique massif
   */
  massiveCritical() {
    this.activate(0.5, 300);
  }
}

/* ============================================
   TRAIL EFFECT SYSTEM
   ============================================ */

class TrailEffectSystem {
  constructor() {
    this.trails = [];
    this.maxTrails = 50;
  }

  /**
   * Crée une particule de trail
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {string} color - Couleur
   * @param {number} size - Taille
   */
  createTrailParticle(x, y, color = '#00ffff', size = 8) {
    if (this.trails.length >= this.maxTrails) {
      // Supprimer la plus ancienne
      this.trails.shift();
    }

    this.trails.push({
      x,
      y,
      color,
      size,
      alpha: 1.0,
      decay: 0.05,
      createdAt: Date.now()
    });
  }

  /**
   * Met à jour les trails
   */
  update() {
    // Diminuer l'alpha et supprimer les trails expirés
    this.trails = this.trails.filter(trail => {
      trail.alpha -= trail.decay;
      return trail.alpha > 0;
    });
  }

  /**
   * Dessine les trails
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera - Objet caméra avec offsetX et offsetY
   */
  draw(ctx, camera) {
    this.trails.forEach(trail => {
      ctx.save();
      ctx.globalAlpha = trail.alpha;
      ctx.fillStyle = trail.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = trail.color;

      // Dessiner avec offset de la caméra
      const screenX = trail.x - camera.offsetX;
      const screenY = trail.y - camera.offsetY;

      ctx.beginPath();
      ctx.arc(screenX, screenY, trail.size * trail.alpha, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  /**
   * Nettoie tous les trails
   */
  clear() {
    this.trails = [];
  }

  /**
   * Obtient le nombre de trails actifs
   * @returns {number}
   */
  getCount() {
    return this.trails.length;
  }
}

/* ============================================
   MAIN SCREEN EFFECTS MANAGER
   ============================================ */

class ScreenEffectsManager {
  constructor(canvasElement) {
    this.flash = new ScreenFlash();
    this.shake = new ScreenShake(canvasElement);
    this.slowMotion = new SlowMotionEffect();
    this.trails = new TrailEffectSystem();
  }

  /**
   * Effet combiné: dégâts joueur (flash + shake léger)
   * @param {number} damagePercent - Pourcentage de vie perdue (0-1)
   */
  onPlayerDamage(damagePercent) {
    const intensity = Math.min(damagePercent, 0.5);
    this.flash.flashDamage(intensity);

    if (damagePercent > 0.1) {
      this.shake.shakeLight();
    }
  }

  /**
   * Effet combiné: critique (flash blanc + shake moyen)
   */
  onCriticalHit() {
    this.flash.flashWhite(0.3);
    this.shake.shakeMedium();
  }

  /**
   * Effet combiné: explosion (flash blanc + shake moyen)
   */
  onExplosion() {
    this.flash.flashWhite(0.4);
    this.shake.shakeMedium();
  }

  /**
   * Effet combiné: mort du boss (flash + shake + slow motion)
   */
  onBossDeath() {
    this.flash.flashWhite(0.5);
    this.shake.shakeHeavy();
    this.slowMotion.bossDeath();
  }

  /**
   * Effet: heal (flash vert)
   */
  onHeal() {
    this.flash.flashHeal(0.25);
  }

  /**
   * Crée un trail de speedboost
   * @param {number} x - Position X
   * @param {number} y - Position Y
   */
  createSpeedTrail(x, y) {
    this.trails.createTrailParticle(x, y, '#00ffff', 6);
  }

  /**
   * Met à jour tous les effets
   * @param {number} deltaTime - Temps écoulé depuis la dernière frame en ms
   */
  update(deltaTime = 16) {
    this.trails.update();
    this.shake.update(deltaTime);
  }

  /**
   * Dessine les trails (à appeler dans la boucle de rendu)
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} camera
   */
  drawTrails(ctx, camera) {
    this.trails.draw(ctx, camera);
  }

  /**
   * Obtient l'échelle de temps (pour slow motion)
   * @returns {number}
   */
  getTimeScale() {
    return this.slowMotion.getTimeScale();
  }

  /**
   * Vérifie si le slow motion est actif
   * @returns {boolean}
   */
  isSlowMotion() {
    return this.slowMotion.isSlowMotion();
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.ScreenEffectsManager = ScreenEffectsManager;
  window.ScreenFlash = ScreenFlash;
  window.ScreenShake = ScreenShake;
  window.SlowMotionEffect = SlowMotionEffect;
  window.TrailEffectSystem = TrailEffectSystem;
}
