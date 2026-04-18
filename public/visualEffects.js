/**
 * VISUAL EFFECTS SYSTEM
 * Advanced particle system, animations, and visual enhancements
 * @version 1.0.0
 */

/* ============================================
   ADVANCED PARTICLE SYSTEM
   ============================================ */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 1000; // Hard cap — death-spiral prevention
    this._pool = []; // Object pool — no alloc per particle
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reducedMotion = mq.matches;
    mq.addEventListener('change', e => {
      this._reducedMotion = e.matches;
      if (this._reducedMotion) {
        this._releaseAll();
      }
    });
  }

  /** Acquire from pool or create new object (no-alloc fast path). */
  _acquire() {
    return this._pool.length > 0 ? this._pool.pop() : {};
  }

  /** Release all live particles back to pool. */
  _releaseAll() {
    for (let i = 0; i < this.particles.length; i++) {
      this._pool.push(this.particles[i]);
    }
    this.particles.length = 0;
  }

  /**
   * LOD multiplier: reduces particle count when FPS < 50.
   * Reads window.performanceSettings.currentFPS (set by GameEngine).
   */
  _lodMult() {
    const fps = window.performanceSettings ? window.performanceSettings.currentFPS : 60;
    return fps < 50 ? 0.4 : 1;
  }

  _skip() {
    return this._reducedMotion;
  }

  /**
   * Crée une explosion de particules
   */
  createExplosion(x, y, color, count = 20, size = 3) {
    if (this._skip()) {
      return;
    }
    if (this.particles.length >= this.maxParticles) {
      return;
    }
    const effective = Math.ceil(count * this._lodMult());
    const maxToCreate = Math.min(effective, this.maxParticles - this.particles.length);
    for (let i = 0; i < maxToCreate; i++) {
      const angle = (Math.PI * 2 * i) / maxToCreate;
      const speed = 2 + Math.random() * 3;
      const p = this._acquire();
      p.x = x; p.y = y;
      p.vx = MathUtils.fastCos(angle) * speed;
      p.vy = MathUtils.fastSin(angle) * speed;
      p.size = size + Math.random() * 2;
      p.color = color; p.life = 1;
      p.decay = 0.02 + Math.random() * 0.015;
      p.gravity = 0.1; p.type = 'explosion';
      this.particles.push(p);
    }
  }

  /**
   * Crée un effet de sang (impact zombie)
   */
  createBloodSplatter(x, y, direction, color = '#00ff00') {
    if (this._skip()) {
      return;
    }
    if (this.particles.length >= this.maxParticles) {
      return;
    }
    const count = Math.ceil(8 * this._lodMult());
    const maxToCreate = Math.min(count, this.maxParticles - this.particles.length);
    for (let i = 0; i < maxToCreate; i++) {
      const angle = direction + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 4;
      const p = this._acquire();
      p.x = x; p.y = y;
      p.vx = MathUtils.fastCos(angle) * speed;
      p.vy = MathUtils.fastSin(angle) * speed;
      p.size = 2 + Math.random() * 3;
      p.color = color; p.life = 1;
      p.decay = 0.012; p.gravity = 0.2; p.type = 'blood';
      this.particles.push(p);
    }
  }

  /**
   * Crée un effet de trail (traînée)
   */
  createTrail(x, y, color, size = 2) {
    if (this._skip() || this.particles.length >= this.maxParticles) {
      return;
    }
    const p = this._acquire();
    p.x = x; p.y = y;
    p.vx = (Math.random() - 0.5) * 0.5;
    p.vy = (Math.random() - 0.5) * 0.5;
    p.size = size; p.color = color; p.life = 1;
    p.decay = 0.02; p.gravity = 0; p.type = 'trail';
    this.particles.push(p);
  }

  /**
   * Crée des étincelles (pour critiques, etc.)
   */
  createSparks(x, y, count = 10) {
    if (this._skip() || this.particles.length >= this.maxParticles) {
      return;
    }
    const effective = Math.ceil(count * this._lodMult());
    const maxToCreate = Math.min(effective, this.maxParticles - this.particles.length);
    for (let i = 0; i < maxToCreate; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const p = this._acquire();
      p.x = x; p.y = y;
      p.vx = MathUtils.fastCos(angle) * speed;
      p.vy = MathUtils.fastSin(angle) * speed;
      p.size = 1 + Math.random() * 2;
      p.color = `hsl(${45 + Math.random() * 30}, 100%, 60%)`;
      p.life = 1; p.decay = 0.025; p.gravity = 0.05; p.type = 'spark';
      this.particles.push(p);
    }
  }

  /**
   * Crée un effet de collecte (or, XP)
   */
  createCollectEffect(x, y, text, color) {
    if (this._skip() || this.particles.length >= this.maxParticles) {
      return;
    }
    const p = this._acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = -1;
    p.size = 14; p.color = color; p.text = text;
    p.life = 1; p.decay = 0.015; p.gravity = 0; p.type = 'text';
    this.particles.push(p);
  }

  /**
   * Crée un effet de heal/buff
   */
  createHealEffect(x, y, radius = 30) {
    if (this._skip() || this.particles.length >= this.maxParticles) {
      return;
    }
    const count = Math.ceil(12 * this._lodMult());
    const maxToCreate = Math.min(count, this.maxParticles - this.particles.length);
    for (let i = 0; i < maxToCreate; i++) {
      const angle = (Math.PI * 2 * i) / maxToCreate;
      const p = this._acquire();
      p.x = x + MathUtils.fastCos(angle) * radius;
      p.y = y + MathUtils.fastSin(angle) * radius;
      p.vx = 0; p.vy = -0.5 - Math.random() * 0.5;
      p.size = 3; p.color = '#00ff88'; p.life = 1;
      p.decay = 0.015; p.gravity = -0.05; p.type = 'heal';
      this.particles.push(p);
    }
  }

  /**
   * Met à jour toutes les particules — swap-and-pop O(1) removal
   */
  update() {
    let len = this.particles.length;
    let i = 0;
    while (i < len) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98; p.vy *= 0.98;
      p.life -= p.decay;
      if (p.life <= 0) {
        this._pool.push(p); // Return to pool — no GC
        len--;
        this.particles[i] = this.particles[len];
        this.particles.length = len;
      } else {
        i++;
      }
    }
  }

  /**
   * Dessine un groupe de particules de même couleur, batchant les arcs par alpha.
   * Quantise globalAlpha à 0.05 pour fusionner les paths → moins de fill() calls.
   */
  _renderColorGroup(ctx, color, group) {
    const ALPHA_STEP = 0.05;
    ctx.fillStyle = color;
    group.sort((a, b) => b.life - a.life);
    let curAlpha = -1;
    let pathOpen = false;
    for (const p of group) {
      const qa = Math.round(p.life / ALPHA_STEP) * ALPHA_STEP;
      if (qa !== curAlpha) {
        if (pathOpen) {
          ctx.fill();
        }
        curAlpha = qa;
        ctx.globalAlpha = Math.min(1, Math.max(0, qa));
        ctx.beginPath();
        pathOpen = true;
      }
      const r = p.size * p.life;
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    if (pathOpen) {
      ctx.fill();
    }
    // Single glow pass per color group (no-op in perf mode via perfPatches.js)
    for (const p of group) {
      if (p.type === 'spark' || p.type === 'heal') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.globalAlpha = p.life * 0.5;
        ctx.beginPath();
        const r = p.size * p.life;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
    }
  }

  /**
   * Dessine toutes les particules — batching par couleur, pas de save/restore.
   */
  render(ctx) {
    if (this.particles.length === 0) {
      return;
    }
    const buckets = new Map();
    const textParticles = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.type === 'text') {
        textParticles.push(p);
      } else {
        let list = buckets.get(p.color);
        if (!list) {
          buckets.set(p.color, (list = []));
        }
        list.push(p);
      }
    }
    for (const [color, group] of buckets) {
      this._renderColorGroup(ctx, color, group);
    }
    ctx.textAlign = 'center';
    for (const p of textParticles) {
      ctx.globalAlpha = p.life;
      ctx.font = `bold ${p.size}px Arial`;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Nettoie toutes les particules
   */
  clear() {
    this._releaseAll();
  }
}

/* ============================================
   ANIMATION SYSTEM
   ============================================ */

class AnimationSystem {
  constructor() {
    this.animations = [];
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
      this._reducedMotion = e.matches;
      if (this._reducedMotion) {
        this.animations = [];
      }
    });
  }

  _skip() {
    return this._reducedMotion;
  }

  /**
   * Crée une animation de dégâts (damage popup)
   */
  createDamageNumber(x, y, damage, isCritical = false) {
    if (this._skip()) {
      return;
    }
    this.animations.push({
      type: 'damage',
      x,
      y,
      startY: y,
      text: `-${Math.round(damage)}`,
      color: isCritical ? '#ff0000' : '#ffffff',
      size: isCritical ? 20 : 16,
      life: 1,
      duration: 1000,
      startTime: Date.now()
    });
  }

  /**
   * Crée une animation de heal
   */
  createHealNumber(x, y, amount) {
    if (this._skip()) {
      return;
    }
    this.animations.push({
      type: 'heal',
      x,
      y,
      startY: y,
      text: `+${Math.round(amount)}`,
      color: '#00ff00',
      size: 16,
      life: 1,
      duration: 1000,
      startTime: Date.now()
    });
  }

  /**
   * Crée une animation de level up
   */
  createLevelUpAnimation(x, y) {
    if (this._skip()) {
      return;
    }
    this.animations.push({
      type: 'levelup',
      x,
      y,
      text: 'LEVEL UP!',
      color: '#ffd700',
      size: 24,
      life: 1,
      duration: 2000,
      startTime: Date.now(),
      scale: 0
    });
  }

  /**
   * Met à jour les animations
   */
  update() {
    const now = Date.now();

    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      const elapsed = now - anim.startTime;
      const progress = elapsed / anim.duration;

      if (progress >= 1) {
        this.animations.splice(i, 1);
        continue;
      }

      anim.life = 1 - progress;

      // Animation spécifique selon le type
      if (anim.type === 'damage' || anim.type === 'heal') {
        anim.y = anim.startY - progress * 30; // Monte
      } else if (anim.type === 'levelup') {
        anim.scale = Math.min(1, progress * 2); // Grossit
      }
    }
  }

  /**
   * Dessine les animations
   */
  render(ctx) {
    this.animations.forEach(anim => {
      ctx.save();
      ctx.globalAlpha = anim.life;
      ctx.font = `bold ${anim.size}px Arial`;
      ctx.fillStyle = anim.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';

      if (anim.type === 'levelup') {
        ctx.save();
        ctx.translate(anim.x, anim.y);
        ctx.scale(anim.scale, anim.scale);
        ctx.strokeText(anim.text, 0, 0);
        ctx.fillText(anim.text, 0, 0);
        ctx.restore();
      } else {
        ctx.strokeText(anim.text, anim.x, anim.y);
        ctx.fillText(anim.text, anim.x, anim.y);
      }

      ctx.restore();
    });
  }

  /**
   * Nettoie toutes les animations
   */
  clear() {
    this.animations = [];
  }
}

/* ============================================
   LIGHTING SYSTEM (Simple) - REMOVED
   ============================================
   Now using advanced LightingSystem from modules/environment/LightingSystem.js
   */

/* ============================================
   ADVANCED EFFECTS MANAGER
   ============================================ */

class AdvancedEffectsManager {
  constructor() {
    this.particles = new ParticleSystem();
    this.animations = new AnimationSystem();
    this.lighting = null; // Deprecated - use window.LightingSystem instead
    this.enabled = true;
    // Screenshake cooldown per-source key — prevents cascade re-triggers
    this._shakeCooldown = new Map();
  }

  /**
   * Trigger screenshake once per source within a cooldown window (ms).
   * @param {'light'|'medium'|'heavy'} level
   * @param {string} sourceKey - unique key (e.g. explosion id or 'player')
   * @param {number} [cooldownMs=300]
   */
  _shake(level, sourceKey, cooldownMs = 300) {
    const now = Date.now();
    if ((this._shakeCooldown.get(sourceKey) || 0) > now) {
return;
}
    this._shakeCooldown.set(sourceKey, now + cooldownMs);
    if (!window.screenEffects || !window.screenEffects.shake) {
return;
}
    window.screenEffects.shake[`shake${level.charAt(0).toUpperCase()}${level.slice(1)}`]?.();
  }

  /**
   * Met à jour tous les effets
   */
  update(_deltaTime = 16) {
    if (!this.enabled) {
      return;
    }
    this.particles.update();
    this.animations.update();
    // Evict expired shake cooldown entries to prevent Map growth
    if (this._shakeCooldown.size > 32) {
      const now = Date.now();
      for (const [k, exp] of this._shakeCooldown) {
        if (exp <= now) {
this._shakeCooldown.delete(k);
}
      }
    }
  }

  /**
   * Dessine tous les effets
   */
  render(ctx, _canvasWidth, _canvasHeight) {
    if (!this.enabled) {
      return;
    }

    // Particules
    this.particles.render(ctx);

    // Animations
    this.animations.render(ctx);
  }

  /**
   * Effet lors d'un tir
   */
  onPlayerShoot(x, y, angle, weaponType) {
    // OPTIMISATION: Réduction drastique des particules pour éviter le lag
    // Particules de fumée réduites de 5 à 2
    this.particles.createExplosion(x, y, 'rgba(150, 150, 150, 0.5)', 2, 1.5);

    // Trail de balle - seulement 1 fois sur 3 pour mitraillette
    if (weaponType !== 'machinegun' || Math.random() < 0.33) {
      const bulletColor =
        weaponType === 'shotgun' ? '#ffaa00' : weaponType === 'machinegun' ? '#ff0000' : '#00ffff';
      this.particles.createTrail(x, y, bulletColor, 2);
    }

    // Note: Screen shake is now handled by ScreenEffectsManager
  }

  /**
   * Effet lors d'un impact sur zombie
   */
  onZombieHit(x, y, angle, damage, isCritical, zombieColor) {
    // Sang (déjà réduit dans createBloodSplatter)
    this.particles.createBloodSplatter(x, y, angle, zombieColor);

    // Étincelles si critique (réduit de 15 à 8)
    if (isCritical) {
      this.particles.createSparks(x, y, 8);
    }

    // Damage number
    this.animations.createDamageNumber(x, y - 20, damage, isCritical);
  }

  /**
   * Effet lors de la mort d'un zombie
   */
  onZombieDeath(x, y, zombieColor) {
    // Réduit de 30 à 15 particules
    this.particles.createExplosion(x, y, zombieColor, 15, 3);
  }

  /**
   * Effet lors d'une explosion
   */
  onExplosion(x, y, _radius) {
    this.particles.createExplosion(x, y, '#ff6600', 25, 4);
    // Onde de choc: spawn 3 bursts au lieu de 10 timers en cascade
    const shockCount = Math.ceil(3 * this.particles._lodMult());
    for (let i = 0; i < shockCount; i++) {
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
        this.particles.createExplosion(x, y, 'rgba(255, 100, 0, 0.3)', 4, 2);
      }, i * 80);
    }
    // Single screenshake per explosion source (cooldown 400ms)
    this._shake('medium', `exp|${Math.round(x)}|${Math.round(y)}`, 400);
  }

  /**
   * Effet de collecte d'or
   */
  onGoldCollect(x, y, amount) {
    this.animations.createDamageNumber(x, y, `+${amount}💰`, false);
    this.particles.createHealEffect(x, y, 15); // Réduit le rayon de 20 à 15
  }

  /**
   * Effet de gain d'XP
   */
  onXPGain(x, y, amount) {
    this.particles.createCollectEffect(x, y, `+${amount} XP`, '#00ffff');
  }

  /**
   * Effet de level up
   */
  onLevelUp(x, y) {
    this.animations.createLevelUpAnimation(x, y);
    this.particles.createExplosion(x, y, '#ffd700', 20, 4); // Réduit de 40 à 20
  }

  /**
   * Effet de heal
   */
  onHeal(x, y, amount) {
    this.animations.createHealNumber(x, y - 20, amount);
    this.particles.createHealEffect(x, y, 20); // Réduit de 30 à 20
  }

  /**
   * Effet de damage player
   */
  onPlayerDamage(x, y, damage) {
    this.animations.createDamageNumber(x, y - 20, damage, true);
  }

  /**
   * Effet de boss spawn
   */
  onBossSpawn(x, y) {
    this.particles.createExplosion(x, y, '#ff0000', 30, 6); // Réduit de 60 à 30
  }

  /**
   * Active/désactive tous les effets
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Nettoie tous les effets
   */
  clear() {
    this.particles.clear();
    this.animations.clear();
    // Note: Lighting is handled separately by modules/environment/LightingSystem.js
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.AdvancedEffectsManager = AdvancedEffectsManager;
  window.ParticleSystem = ParticleSystem;
  // Note: ScreenShake is exported from screenEffects.js
  window.AnimationSystem = AnimationSystem;
  // Note: LightingSystem is exported from modules/environment/LightingSystem.js
}
