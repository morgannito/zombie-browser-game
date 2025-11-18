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
    this.maxParticles = 300; // Limite réduite pour meilleures performances (500 -> 300)
  }

  /**
   * Crée une explosion de particules
   */
  createExplosion(x, y, color, count = 20, size = 3) {
    // Vérification de la limite de particules
    if (this.particles.length >= this.maxParticles) return;

    // Limiter le nombre de particules créées
    const maxToCreate = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < maxToCreate; i++) {
      const angle = (Math.PI * 2 * i) / maxToCreate;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: MathUtils.fastCos(angle) * speed,
        vy: MathUtils.fastSin(angle) * speed,
        size: size + Math.random() * 2,
        color,
        life: 1,
        decay: 0.02 + Math.random() * 0.015, // Disparaissent plus vite
        gravity: 0.1,
        type: 'explosion'
      });
    }
  }

  /**
   * Crée un effet de sang (impact zombie)
   */
  createBloodSplatter(x, y, direction, color = '#00ff00') {
    // Vérification de la limite de particules
    if (this.particles.length >= this.maxParticles) return;

    const count = 8; // Réduit de 15 à 8
    const maxToCreate = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < maxToCreate; i++) {
      const spread = 0.5;
      const angle = direction + (Math.random() - 0.5) * spread;
      const speed = 3 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: MathUtils.fastCos(angle) * speed,
        vy: MathUtils.fastSin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        life: 1,
        decay: 0.012, // Disparaissent plus vite (0.008 -> 0.012)
        gravity: 0.2,
        type: 'blood'
      });
    }
  }

  /**
   * Crée un effet de trail (traînée)
   */
  createTrail(x, y, color, size = 2) {
    if (this.particles.length < this.maxParticles) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size,
        color,
        life: 1,
        decay: 0.02,
        gravity: 0,
        type: 'trail'
      });
    }
  }

  /**
   * Crée des étincelles (pour critiques, etc.)
   */
  createSparks(x, y, count = 10) {
    // Vérification de la limite de particules
    if (this.particles.length >= this.maxParticles) return;

    const maxToCreate = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < maxToCreate; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: MathUtils.fastCos(angle) * speed,
        vy: MathUtils.fastSin(angle) * speed,
        size: 1 + Math.random() * 2,
        color: `hsl(${45 + Math.random() * 30}, 100%, 60%)`, // Jaune/orange
        life: 1,
        decay: 0.025, // Disparaissent plus vite
        gravity: 0.05,
        type: 'spark'
      });
    }
  }

  /**
   * Crée un effet de collecte (or, XP)
   */
  createCollectEffect(x, y, text, color) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -1,
      size: 14,
      color,
      text,
      life: 1,
      decay: 0.015,
      gravity: 0,
      type: 'text'
    });
  }

  /**
   * Crée un effet de heal/buff
   */
  createHealEffect(x, y, radius = 30) {
    // Vérification de la limite de particules
    if (this.particles.length >= this.maxParticles) return;

    const count = 12; // Réduit de 20 à 12
    const maxToCreate = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < maxToCreate; i++) {
      const angle = (Math.PI * 2 * i) / maxToCreate;
      this.particles.push({
        x: x + MathUtils.fastCos(angle) * radius,
        y: y + MathUtils.fastSin(angle) * radius,
        vx: 0,
        vy: -0.5 - Math.random() * 0.5,
        size: 3,
        color: '#00ff88',
        life: 1,
        decay: 0.015, // Disparaissent plus vite
        gravity: -0.05, // Remonte
        type: 'heal'
      });
    }
  }

  /**
   * Met à jour toutes les particules
   */
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Mise à jour position
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;

      // Friction
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Durée de vie
      p.life -= p.decay;

      // Suppression si mort
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Dessine toutes les particules
   */
  render(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;

      if (p.type === 'text') {
        // Texte flottant (pour afficher +gold, +XP)
        ctx.font = `bold ${p.size}px Arial`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        // Particule normale
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect pour certaines particules
        if (p.type === 'spark' || p.type === 'heal') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
        }
      }

      ctx.restore();
    });
  }

  /**
   * Nettoie toutes les particules
   */
  clear() {
    this.particles = [];
  }
}

/* ============================================
   ANIMATION SYSTEM
   ============================================ */

class AnimationSystem {
  constructor() {
    this.animations = [];
  }

  /**
   * Crée une animation de dégâts (damage popup)
   */
  createDamageNumber(x, y, damage, isCritical = false) {
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
   LIGHTING SYSTEM (Simple)
   ============================================ */

class LightingSystem {
  constructor() {
    this.lights = [];
    this.ambientLight = 0.3; // Luminosité ambiante (0-1)
  }

  /**
   * Ajoute une source de lumière
   */
  addLight(x, y, radius, color = 'rgba(255, 255, 200, 0.3)') {
    this.lights.push({ x, y, radius, color });
  }

  /**
   * Applique l'éclairage (overlay sombre avec zones éclairées)
   */
  render(ctx, canvasWidth, canvasHeight) {
    // Overlay sombre
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - this.ambientLight})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Zones éclairées
    ctx.globalCompositeOperation = 'destination-out';
    this.lights.forEach(light => {
      const gradient = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, light.radius
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Nettoie les lumières
   */
  clear() {
    this.lights = [];
  }

  /**
   * Active/désactive le mode nuit
   */
  setNightMode(enabled) {
    this.ambientLight = enabled ? 0.1 : 0.3;
  }
}

/* ============================================
   ADVANCED EFFECTS MANAGER
   ============================================ */

class AdvancedEffectsManager {
  constructor() {
    this.particles = new ParticleSystem();
    // Note: Screen shake is now handled by ScreenEffectsManager (from screenEffects.js)
    this.animations = new AnimationSystem();
    this.lighting = new LightingSystem();
    this.enabled = true;
  }

  /**
   * Met à jour tous les effets
   */
  update(deltaTime = 16) {
    if (!this.enabled) return;

    this.particles.update();
    this.animations.update();
  }

  /**
   * Dessine tous les effets
   */
  render(ctx, canvasWidth, canvasHeight) {
    if (!this.enabled) return;

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
      const bulletColor = weaponType === 'shotgun' ? '#ffaa00' :
                         weaponType === 'machinegun' ? '#ff0000' : '#00ffff';
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
  onExplosion(x, y, radius) {
    // Réduit de 50 à 25 particules pour l'explosion principale
    this.particles.createExplosion(x, y, '#ff6600', 25, 4);

    // Onde de choc réduite (20 -> 10 ondes, 10 -> 5 particules)
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.particles.createExplosion(x, y, 'rgba(255, 100, 0, 0.3)', 5, 2);
      }, i * 30);
    }
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
    this.lighting.clear();
  }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
  window.AdvancedEffectsManager = AdvancedEffectsManager;
  window.ParticleSystem = ParticleSystem;
  // Note: ScreenShake is exported from screenEffects.js
  window.AnimationSystem = AnimationSystem;
  window.LightingSystem = LightingSystem;
}
