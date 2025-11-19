/**
 * PERFORMANCE UTILITIES - Client Side
 * Optimisations pour le rendu et la gestion du DOM
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ===============================================
  // DEBOUNCE & THROTTLE
  // ===============================================

  /**
   * Debounce - Retarde l'exécution jusqu'à ce que les appels cessent
   * @param {Function} func
   * @param {number} wait - Délai en ms
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = (window.timerManager ? window.timerManager.setTimeout : setTimeout)(later, wait);
    };
  }

  /**
   * Throttle - Limite le nombre d'exécutions par période
   * @param {Function} func
   * @param {number} limit - Délai minimum entre appels en ms
   * @returns {Function}
   */
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => inThrottle = false, limit);
      }
    };
  }

  // ===============================================
  // BATCH RENDERING
  // ===============================================

  /**
   * Grouper des éléments par propriété pour batch rendering
   * @param {Array} items - Items à grouper
   * @param {string} key - Clé pour grouper
   * @returns {Object} Items groupés par clé
   */
  function groupBy(items, key) {
    return items.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  /**
   * Render des balles en batch (groupées par couleur)
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} bullets
   * @param {Object} config
   */
  function renderBulletsBatched(ctx, bullets, config) {
    const bulletsArray = Object.values(bullets);
    if (bulletsArray.length === 0) return;

    // Grouper par couleur
    const bulletsByColor = groupBy(bulletsArray, 'color');

    // Render par batch de couleur
    Object.entries(bulletsByColor).forEach(([color, bullets]) => {
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;

      bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, config.BULLET_SIZE || 5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.shadowBlur = 0;
  }

  // ===============================================
  // DOM CACHE
  // ===============================================

  /**
   * Cache pour les queries DOM
   */
  class DOMCache {
    constructor() {
      this.cache = new Map();
    }

    /**
     * Get un élément (avec cache)
     * @param {string} selector
     * @returns {HTMLElement}
     */
    get(selector) {
      if (!this.cache.has(selector)) {
        this.cache.set(selector, document.querySelector(selector));
      }
      return this.cache.get(selector);
    }

    /**
     * Get tous les éléments (avec cache)
     * @param {string} selector
     * @returns {NodeList}
     */
    getAll(selector) {
      if (!this.cache.has(selector)) {
        this.cache.set(selector, document.querySelectorAll(selector));
      }
      return this.cache.get(selector);
    }

    /**
     * Invalider le cache
     * @param {string} selector - Si null, tout invalider
     */
    invalidate(selector = null) {
      if (selector) {
        this.cache.delete(selector);
      } else {
        this.cache.clear();
      }
    }
  }

  // ===============================================
  // PARTICLE OPTIMIZATION
  // ===============================================

  /**
   * Update particules avec swap-and-pop (pas de splice)
   * @param {Array} particles
   * @param {number} deltaTime
   * @returns {Array} Particules actives
   */
  function updateParticlesOptimized(particles, deltaTime) {
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < particles.length; readIndex++) {
      const p = particles[readIndex];

      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy += (p.gravity || 0) * deltaTime;
      p.vx *= (p.friction || 0.98);
      p.vy *= (p.friction || 0.98);
      p.life -= (p.decay || 0.016) * deltaTime;

      // Garder seulement les vivantes
      if (p.life > 0) {
        particles[writeIndex] = p;
        writeIndex++;
      }
    }

    // Tronquer l'array (au lieu de splice)
    particles.length = writeIndex;
    return particles;
  }

  // ===============================================
  // REQUEST ANIMATION FRAME UTILITIES
  // ===============================================

  /**
   * Mesurer les FPS réels
   */
  class FPSMeter {
    constructor(sampleSize = 60) {
      this.sampleSize = sampleSize;
      this.frames = [];
      this.lastTime = performance.now();
      this.fps = 60;
    }

    update() {
      const now = performance.now();
      const delta = now - this.lastTime;
      this.lastTime = now;

      this.frames.push(1000 / delta);

      if (this.frames.length > this.sampleSize) {
        this.frames.shift();
      }

      this.fps = this.frames.reduce((a, b) => a + b) / this.frames.length;
      return this.fps;
    }

    getFPS() {
      return Math.round(this.fps);
    }
  }

  // ===============================================
  // EXPORTS
  // ===============================================

  window.PerformanceUtils = {
    debounce,
    throttle,
    groupBy,
    renderBulletsBatched,
    DOMCache,
    updateParticlesOptimized,
    FPSMeter
  };

})();
