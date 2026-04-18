/**
 * EFFECTS RENDERER
 * Handles rendering of particles, explosions, poison trails, weather, lighting effects
 * @module EffectsRenderer
 * @author Claude Code
 * @version 1.0.0
 */

// Hoisted constant — avoids new Set() allocation every frame in renderDynamicPropParticles
const _FIRE_COLORS = new Set(['#ff6600', '#ffaa00', '#ffff00']);

class EffectsRenderer {
  // ── Particle Pool ────────────────────────────────────────────────────────
  static POOL_SIZE = 500;
  static MAX_ACTIVE = 300;

  _initPool() {
    this._pool = new Array(EffectsRenderer.POOL_SIZE);
    for (let i = 0; i < EffectsRenderer.POOL_SIZE; i++) {
      this._pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', createdAt: 0, lifetime: 0, kind: '' };
    }
    this._poolHead = 0;
    this._activeCount = 0;
  }

  _acquireParticle() {
    if (this._activeCount >= EffectsRenderer.MAX_ACTIVE) {
      // Evict oldest active particle
      for (let i = 0; i < EffectsRenderer.POOL_SIZE; i++) {
        if (this._pool[i].active) {
          this._pool[i].active = false;
          this._activeCount--;
          break;
        }
      }
    }
    // Find next free slot (circular)
    for (let i = 0; i < EffectsRenderer.POOL_SIZE; i++) {
      const idx = (this._poolHead + i) % EffectsRenderer.POOL_SIZE;
      if (!this._pool[idx].active) {
        this._poolHead = (idx + 1) % EffectsRenderer.POOL_SIZE;
        this._pool[idx].active = true;
        this._activeCount++;
        return this._pool[idx];
      }
    }
    // All slots taken (shouldn't reach here after eviction, but fallback)
    const p = this._pool[this._poolHead];
    p.active = true;
    this._poolHead = (this._poolHead + 1) % EffectsRenderer.POOL_SIZE;
    return p;
  }

  constructor() {
    this._initPool();
    // Muzzle flashes — client-only, triggered on shoot
    this._muzzleFlashes = [];

    // Scorch decals — client-only persistent marks left after explosions fade.
    this.scorchDecals = [];
    this._scorchedExplosionIds = new Set();
    this.SCORCH_LIFETIME_MS = 8000;
    this.SCORCH_MAX = 48;
    // Reusable maps for particle color batching (avoids new Map() each frame)
    this._particleByColor = new Map();
    this._dynPropBuckets = new Map(); // reused in renderDynamicPropParticles
    // Path2D cache: trailId/poolId → { path, radius } — avoids re-creating per frame
    this._trailPaths = new Map();
    this._poolPaths = new Map();
    this._toxicIdSet = new Set(); // preallocated, cleared per frame

    // --- GORE SYSTEM ---
    // _bloodParticles replaced by shared particle pool (kind='blood')
    this._bloodPools = [];       // { x, y, radius, createdAt }
    this._zombieLastHealth = {}; // zombieId → last known health
    this.BLOOD_POOL_LIFETIME = 3000;
    this.BLOOD_PARTICLE_LIFETIME = 800;
    this.BLOOD_POOL_MAX = 32;

    // --- HAZARD BUBBLES ---
    this._hazardBubbles = []; // { x, y, vy, size, alpha, createdAt, lifetime }
    this._lastBubbleSpawn = 0;

    // --- HAZARD WARNING ---
    this._hazardWarningStart = 0; // timestamp when player entered hazard
    this._inHazardPrev = false;
  }

  _spawnScorchDecal(explosion, now) {
    const key = explosion.id || `${explosion.x}|${explosion.y}|${explosion.createdAt}`;
    if (this._scorchedExplosionIds.has(key)) {
      return;
    }
    this._scorchedExplosionIds.add(key);
    this.scorchDecals.push({
      id: key,
      x: explosion.x,
      y: explosion.y,
      radius: explosion.radius * 0.85,
      createdAt: now,
      isRocket: !!explosion.isRocket
    });
    if (this.scorchDecals.length > this.SCORCH_MAX) {
      const removed = this.scorchDecals.shift();
      if (removed) {
        this._scorchedExplosionIds.delete(removed.id);
      }
    }
  }

  renderScorchDecals(ctx, camera, now) {
    now = now || Date.now();
    for (let i = this.scorchDecals.length - 1; i >= 0; i--) {
      const d = this.scorchDecals[i];
      const age = now - d.createdAt;
      if (age >= this.SCORCH_LIFETIME_MS) {
        this.scorchDecals.splice(i, 1);
        continue;
      }
      if (!camera.isInViewport(d.x, d.y, d.radius * 2)) {
        continue;
      }
      const fade = 1 - age / this.SCORCH_LIFETIME_MS;
      ctx.save();
      ctx.globalAlpha = fade * 0.55;
      ctx.fillStyle = d.isRocket ? '#1a0a0a' : '#1f1208';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade * 0.35;
      ctx.fillStyle = d.isRocket ? '#3a1a1a' : '#3a2410';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderParticles(ctx, camera, particles) {
    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    if (!particles) {
      return;
    }

    // LOD: skip every other particle when FPS < 50
    const fps = window.performanceSettings ? window.performanceSettings.currentFPS : 60;
    const skipAlt = fps < 50;

    // Batch particles by color: 1 beginPath/fill per color group (reuse instance map)
    const byColor = this._particleByColor;
    byColor.clear();
    const HARD_CAP = 1000;
    let rendered = 0;
    for (const particleId in particles) {
      if (rendered >= HARD_CAP) {
break;
}
      if (skipAlt && (rendered & 1) === 1) {
 rendered++; continue;
}
      const particle = particles[particleId];
      rendered++;
      if (!camera.isInViewport(particle.x, particle.y, 50)) {
        continue;
      }
      const color = particle.color;
      if (!byColor.has(color)) {
        byColor.set(color, []);
      }
      byColor.get(color).push(particle);
    }

    ctx.globalAlpha = 0.7;
    for (const [color, group] of byColor) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const particle of group) {
        ctx.moveTo(particle.x + particle.size, particle.y);
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  renderDynamicPropParticles(ctx, camera, particles) {
    if (!particles || particles.length === 0) {
      return;
    }

    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    const FIRE_COLORS = _FIRE_COLORS;

    // Batch by color+alpha key; fire particles need a glow pass so keep separate
    const normalBuckets = this._dynPropBuckets;
    normalBuckets.clear();
    const glowParticles = [];

    for (const particle of particles) {
      if (!camera.isInViewport(particle.x, particle.y, 50)) {
        continue;
      }

      const color = typeof particle.color === 'string' ? particle.color : '#fff';
      const alpha = particle.alpha !== null && particle.alpha !== undefined ? particle.alpha : 1;

      if (FIRE_COLORS.has(color)) {
        glowParticles.push(particle);
        continue;
      }

      const key = `${color}|${alpha}`;
      if (!normalBuckets.has(key)) {
        normalBuckets.set(key, { color, alpha, list: [] });
      }
      normalBuckets.get(key).list.push(particle);
    }

    // Draw normal batches
    for (const { color, alpha, list } of normalBuckets.values()) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const p of list) {
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Draw fire/glow particles individually (shadow + flicker)
    const fireNow = Date.now();
    for (const particle of glowParticles) {
      const color = particle.color;
      const alpha = particle.alpha !== null && particle.alpha !== undefined ? particle.alpha : 1;
      // Flicker: each particle gets a unique phase based on position to avoid sync
      const flicker = 0.7 + 0.3 * Math.abs(Math.sin(fireNow / 60 + particle.x * 0.1 + particle.y * 0.07));
      ctx.globalAlpha = alpha * flicker;
      ctx.fillStyle = color;
      ctx.shadowBlur = 8 + 6 * flicker;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * flicker, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  renderPoisonTrails(ctx, camera, poisonTrails, now) {
    now = now || Date.now();
    const trails = poisonTrails || {};

    // Evict stale Path2D cache entries for trails no longer present
    for (const id of this._trailPaths.keys()) {
      if (!trails[id]) {
this._trailPaths.delete(id);
}
    }

    for (const trailId in trails) {
      const trail = trails[trailId];
      if (!camera.isInViewport(trail.x, trail.y, trail.radius * 2)) {
continue;
}

      // Reuse or create Path2D (never recreate if position/radius unchanged)
      let cached = this._trailPaths.get(trailId);
      if (!cached || cached.x !== trail.x || cached.y !== trail.y || cached.r !== trail.radius) {
        const outer = new Path2D(); outer.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
        const inner = new Path2D(); inner.arc(trail.x, trail.y, trail.radius * 0.6, 0, Math.PI * 2);
        cached = { outer, inner, x: trail.x, y: trail.y, r: trail.radius };
        this._trailPaths.set(trailId, cached);
      }

      const pulseAmount = Math.sin(now / 300) * 0.1;
      const fadeAmount = Math.max(0, 1 - (now - trail.createdAt) / trail.duration);

      ctx.fillStyle = '#22ff22';
      ctx.globalAlpha = (0.15 + pulseAmount) * fadeAmount;
      ctx.fill(cached.outer);

      ctx.fillStyle = '#11dd11';
      ctx.globalAlpha = (0.3 + pulseAmount * 0.5) * fadeAmount;
      ctx.fill(cached.inner);

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.globalAlpha = (0.4 + pulseAmount) * fadeAmount;
      ctx.stroke(cached.outer);

      ctx.globalAlpha = 1;
    }
  }

  renderToxicPools(ctx, camera, toxicPools, now) {
    if (!toxicPools || !Array.isArray(toxicPools)) {
return;
}
    now = now || Date.now();

    // Evict stale cache entries
    this._toxicIdSet.clear();
    for (const p of toxicPools) {
this._toxicIdSet.add(p.id);
}
    for (const id of this._poolPaths.keys()) {
      if (!this._toxicIdSet.has(id)) {
this._poolPaths.delete(id);
}
    }

    for (const pool of toxicPools) {
      if (!camera.isInViewport(pool.x, pool.y, pool.radius * 2)) {
continue;
}

      // Reuse or build Path2D cache
      let c = this._poolPaths.get(pool.id);
      if (!c || c.x !== pool.x || c.y !== pool.y || c.r !== pool.radius) {
        const mk = (r) => {
 const p = new Path2D(); p.arc(pool.x, pool.y, r, 0, Math.PI * 2); return p;
};
        c = { outer: mk(pool.radius * 1.2), mid: mk(pool.radius), inner: mk(pool.radius * 0.5), core: mk(pool.radius * 0.3), x: pool.x, y: pool.y, r: pool.radius };
        this._poolPaths.set(pool.id, c);
      }

      const pulseAmount = Math.sin(now / 200) * 0.15;
      const fadeAmount = Math.max(0, 1 - (now - pool.createdAt) / pool.duration);

      ctx.save();
      ctx.fillStyle = '#00ff00';   ctx.globalAlpha = (0.2 + pulseAmount) * fadeAmount;           ctx.fill(c.outer);
      ctx.fillStyle = '#22ff22';   ctx.globalAlpha = (0.4 + pulseAmount * 0.8) * fadeAmount;     ctx.fill(c.mid);
      ctx.fillStyle = '#00dd00';   ctx.globalAlpha = (0.6 + pulseAmount * 1.2) * fadeAmount;     ctx.fill(c.inner);
      ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 3; ctx.globalAlpha = (0.6 + pulseAmount * 1.5) * fadeAmount; ctx.stroke(c.mid);
      ctx.shadowBlur = 20; ctx.shadowColor = '#00ff00';
      ctx.globalAlpha = (0.3 + pulseAmount) * fadeAmount;                                         ctx.fill(c.core);
      ctx.restore();

      // Spawn bubbles periodically
      if (now - this._lastBubbleSpawn > 80) {
        this._lastBubbleSpawn = now;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * pool.radius * 0.8;
        this._hazardBubbles.push({
          x: pool.x + Math.cos(angle) * dist,
          y: pool.y + Math.sin(angle) * dist,
          vy: -(0.4 + Math.random() * 0.6),
          size: 2 + Math.random() * 3,
          alpha: 0.7 + Math.random() * 0.3,
          createdAt: now,
          lifetime: 600 + Math.random() * 400
        });
      }
    }

    // Render & update bubbles
    ctx.save();
    for (let i = this._hazardBubbles.length - 1; i >= 0; i--) {
      const b = this._hazardBubbles[i];
      const age = now - b.createdAt;
      if (age >= b.lifetime) {
 this._hazardBubbles.splice(i, 1); continue;
}
      b.y += b.vy;
      const t = age / b.lifetime;
      ctx.globalAlpha = b.alpha * (1 - t);
      ctx.strokeStyle = '#44ff44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  renderExplosions(ctx, camera, explosions, now) {
    now = now || Date.now();
    const explosionMap = explosions || {};

    for (const explosionId in explosionMap) {
      const explosion = explosionMap[explosionId];
      const age = now - explosion.createdAt;
      const progress = age / explosion.duration;

      if (progress >= 1) {
        continue;
      }

      // Spawn scorch decal once per explosion (persists after flash fades).
      if (progress > 0.5) {
        this._spawnScorchDecal(explosion, now);
      }

      if (!camera.isInViewport(explosion.x, explosion.y, explosion.radius * 2)) {
        continue;
      }

      const currentRadius = explosion.radius * (0.3 + progress * 0.7);
      const alpha = 1 - progress;

      if (explosion.isRocket) {
        this._renderRocketExplosion(ctx, explosion, currentRadius, alpha);
      } else {
        ctx.fillStyle = '#ff8800';
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffff00';
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, currentRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }

  _renderRocketExplosion(ctx, explosion, currentRadius, alpha) {
    ctx.fillStyle = '#ff0000';
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff8800';
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, currentRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffff00';
    ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, currentRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, currentRadius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.6;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rayLength = currentRadius * 1.2;
      ctx.beginPath();
      ctx.moveTo(explosion.x, explosion.y);
      ctx.lineTo(
        explosion.x + Math.cos(angle) * rayLength,
        explosion.y + Math.sin(angle) * rayLength
      );
      ctx.stroke();
    }
  }

  renderEnvironmentalParticles(ctx, _camera, envParticles) {
    if (!envParticles || !envParticles.particles) {
      return;
    }

    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    ctx.save();

    envParticles.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.glow) {
        // Use shadowBlur instead of createRadialGradient — avoids gradient alloc per particle
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.shadowBlur = 0;
      } else if (p.rotation !== undefined) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    });

    ctx.restore();
  }

  applyWeatherFog(ctx, canvas, weather, stage) {
    if (!weather || weather.intensity === 0) {
      return;
    }

    if (stage === 'before') {
      if (weather.ambientLight < 1) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${(1 - weather.ambientLight) * weather.intensity * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    } else if (stage === 'after') {
      if (weather.fogDensity > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(200, 200, 220, ${weather.fogDensity * weather.intensity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      if (weather.lightning) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
  }

  applyAmbientDarkness(ctx, canvas, camera, lighting) {
    if (!lighting || lighting.ambientLight >= 0.95) {
      return;
    }

    const darkness = 1 - lighting.ambientLight;
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${darkness * 0.7})`;
    ctx.fillRect(
      camera.x,
      camera.y,
      canvas.width / (window.devicePixelRatio || 1),
      canvas.height / (window.devicePixelRatio || 1)
    );
    ctx.restore();
  }

  renderDynamicLights(ctx, camera, lighting) {
    if (!lighting || !lighting.lights || lighting.lights.length === 0) {
      return;
    }

    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    lighting.lights.forEach(light => {
      if (!light.enabled) {
        return;
      }

      if (!camera.isInViewport(light.x, light.y, light.radius * 2)) {
        return;
      }

      const gradient = ctx.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        light.radius * light.currentIntensity
      );

      gradient.addColorStop(0, light.color);
      gradient.addColorStop(
        0.5,
        light.color.replace(/[\d.]+\)$/g, `${light.currentIntensity * 0.3})`)
      );
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(
        light.x - light.radius,
        light.y - light.radius,
        light.radius * 2,
        light.radius * 2
      );
    });

    ctx.restore();
  }

  renderWeather(ctx, _camera, weather) {
    if (!weather || weather.intensity === 0) {
      return;
    }

    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    if (weather.raindrops && weather.raindrops.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(150, 180, 200, 0.4)';
      ctx.lineWidth = 1;

      weather.raindrops.forEach(drop => {
        ctx.globalAlpha = drop.alpha;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.vx, drop.y + drop.length);
        ctx.stroke();
      });

      ctx.restore();
    }

    if (weather.snowflakes && weather.snowflakes.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

      weather.snowflakes.forEach(flake => {
        ctx.save();
        ctx.globalAlpha = flake.alpha;
        ctx.translate(flake.x, flake.y);
        ctx.rotate(flake.rotation);

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * flake.size;
          const y = Math.sin(angle) * flake.size;
          ctx.moveTo(0, 0);
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.restore();
      });

      ctx.restore();
    }
  }
  // ── Muzzle Flash ────────────────────────────────────────────────────────

  /** Barrel tip offsets (local x along weapon axis) and flash config per weapon type */
  static _MUZZLE_CFG = {
    pistol:        { offset: 31, radius: 12, duration: 70  },
    shotgun:       { offset: 42, radius: 18, duration: 80  },
    machinegun:    { offset: 45, radius: 15, duration: 60  },
    rocketlauncher:{ offset: 48, radius: 32, duration: 100 }
  };

  /**
   * Register a muzzle flash at the barrel tip.
   * @param {number} x  - player world x
   * @param {number} y  - player world y
   * @param {number} angle - firing angle (radians)
   * @param {string} weaponType
   */
  addMuzzleFlash(x, y, angle, weaponType) {
    const cfg = EffectsRenderer._MUZZLE_CFG[weaponType] || EffectsRenderer._MUZZLE_CFG.pistol;
    const tx = x + Math.cos(angle) * cfg.offset;
    const ty = y + Math.sin(angle) * cfg.offset;
    this._muzzleFlashes.push({ x: tx, y: ty, radius: cfg.radius, duration: cfg.duration, startTime: performance.now() });
  }

  /**
   * Draw all active muzzle flashes (call after players are drawn).
   */
  renderMuzzleFlashes(ctx, camera, now) {
    now = now || performance.now();
    for (let i = this._muzzleFlashes.length - 1; i >= 0; i--) {
      const f = this._muzzleFlashes[i];
      const elapsed = now - f.startTime;
      if (elapsed >= f.duration) {
        this._muzzleFlashes.splice(i, 1);
        continue;
      }
      const alpha = 1 - elapsed / f.duration;
      const sx = f.x - camera.x;
      const sy = f.y - camera.y;

      ctx.save();
      // Outer glow (radial gradient, ~50px)
      const glowR = f.radius * 3.5;
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grd.addColorStop(0,   `rgba(255, 220, 80, ${alpha * 0.9})`);
      grd.addColorStop(0.25,`rgba(255, 140, 20, ${alpha * 0.6})`);
      grd.addColorStop(1,   'rgba(255, 80,  0,  0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.95})`;
      ctx.beginPath();
      ctx.arc(sx, sy, f.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // ── GORE SYSTEM ─────────────────────────────────────────────────────────

  _isGoreEnabled() {
    return !window.gameSettings || window.gameSettings.bloodEnabled !== false;
  }

  _spawnBloodParticles(x, y, count, speedMult) {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1 + Math.random() * 3) * (speedMult || 1);
      const p = this._acquireParticle();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 1.5;
      p.size = 2 + Math.random() * 3;
      p.color = '';
      p.createdAt = now;
      p.lifetime = this.BLOOD_PARTICLE_LIFETIME;
      p.kind = 'blood';
    }
  }

  _spawnBloodPool(x, y, radius) {
    const now = Date.now();
    if (this._bloodPools.length >= this.BLOOD_POOL_MAX) {
      this._bloodPools.shift();
    }
    this._bloodPools.push({ x, y, radius: radius || 12, createdAt: now });
  }

  /**
   * Called each render frame with current zombie state.
   * Detects hits and deaths, spawns gore accordingly.
   */
  processZombieGore(zombies) {
    if (!this._isGoreEnabled()) {
return;
}

    for (const id in zombies) {
      const z = zombies[id];
      if (!z) {
continue;
}

      const last = this._zombieLastHealth[id];
      const hp = z.health;

      if (last !== undefined && hp < last) {
        const isDead = hp <= 0;
        if (isDead) {
          const isBoss = z.isBoss;
          const count = isBoss ? 20 : (10 + Math.floor(Math.random() * 6));
          this._spawnBloodParticles(z.x, z.y, count, isBoss ? 2.5 : 1);
          this._spawnBloodPool(z.x, z.y, isBoss ? 28 : 14);
          if (isBoss && window.screenEffects && window.gameSettings && window.gameSettings.screenShakeEnabled !== false) {
            window.screenEffects.shake.shakeHeavy();
          }
        } else {
          // Hit: 2-3 droplets
          this._spawnBloodParticles(z.x, z.y, 2 + Math.floor(Math.random() * 2), 0.7);
        }
      }

      if (hp > 0) {
        this._zombieLastHealth[id] = hp;
      } else {
        delete this._zombieLastHealth[id];
      }
    }

    // Clean up stale entries for removed zombies
    for (const id in this._zombieLastHealth) {
      if (!zombies[id]) {
delete this._zombieLastHealth[id];
}
    }
  }

  renderBloodEffects(ctx, camera, now) {
    if (!this._isGoreEnabled()) {
return;
}
    now = now || Date.now();

    // Blood pools (persistent, floor level)
    for (let i = this._bloodPools.length - 1; i >= 0; i--) {
      const pool = this._bloodPools[i];
      const age = now - pool.createdAt;
      if (age >= this.BLOOD_POOL_LIFETIME) {
 this._bloodPools.splice(i, 1); continue;
}
      if (!camera.isInViewport(pool.x, pool.y, pool.radius * 2)) {
continue;
}

      const fade = 1 - age / this.BLOOD_POOL_LIFETIME;
      ctx.save();
      ctx.globalAlpha = 0.3 * fade;
      ctx.fillStyle = '#6b0000';
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, pool.radius, pool.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Blood particles (gravity + fade) — pooled, active flag used instead of splice
    const GRAVITY = 0.15;
    ctx.save();
    ctx.fillStyle = '#cc0000';
    for (let i = 0; i < EffectsRenderer.POOL_SIZE; i++) {
      const p = this._pool[i];
      if (!p.active || p.kind !== 'blood') {
continue;
}
      const age = now - p.createdAt;
      if (age >= p.lifetime) {
 p.active = false; this._activeCount--; continue;
}

      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY;
      p.vx *= 0.92;

      if (!camera.isInViewport(p.x, p.y, 10)) {
continue;
}

      ctx.globalAlpha = (1 - age / p.lifetime) * 0.85;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // --- Bullet impact sparks + ghost trails ---

  addBulletImpact(x, y, color) {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      const p = this._acquireParticle();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 2;
      p.color = color;
      p.createdAt = now;
      p.lifetime = 120;
      p.kind = 'impact';
    }
  }

  addBulletGhost(bullet, color) {
    const p = this._acquireParticle();
    p.x = bullet.x; p.y = bullet.y;
    p.vx = 0; p.vy = 0;
    p.size = bullet.size || 5;
    p.color = color;
    p.createdAt = Date.now();
    p.lifetime = 100;
    p.kind = 'ghost';
  }

  renderBulletEffects(ctx, camera, now) {
    now = now || Date.now();

    // Render impact sparks — pooled
    ctx.save();
    ctx.shadowBlur = 6;
    for (let i = 0; i < EffectsRenderer.POOL_SIZE; i++) {
      const s = this._pool[i];
      if (!s.active || s.kind !== 'impact') {
continue;
}
      const age = now - s.createdAt;
      if (age >= s.lifetime) {
 s.active = false; this._activeCount--; continue;
}
      if (!camera.isInViewport(s.x, s.y, 20)) {
continue;
}
      const t = age / s.lifetime;
      s.x += s.vx * (1 - t);
      s.y += s.vy * (1 - t);
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.shadowColor = s.color;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.5, s.size * (1 - t * 0.7)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // Render ghost remnants — pooled
    ctx.save();
    ctx.shadowBlur = 8;
    for (let i = 0; i < EffectsRenderer.POOL_SIZE; i++) {
      const g = this._pool[i];
      if (!g.active || g.kind !== 'ghost') {
continue;
}
      const age = now - g.createdAt;
      if (age >= g.lifetime) {
 g.active = false; this._activeCount--; continue;
}
      if (!camera.isInViewport(g.x, g.y, 20)) {
continue;
}
      const t = age / g.lifetime;
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.shadowColor = g.color;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.size * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  /**
   * Render a pulsing red "!" above the local player when inside a hazard zone.
   * Call this in SCREEN SPACE (after ctx.translate(-cam.x, -cam.y)).
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   * @param {object} player  - { x, y }
   * @param {Array}  toxicPools  - from gameState.state.toxicPools
   * @param {object} poisonTrails - from gameState.state.poisonTrails
   * @param {number} now
   */
  renderHazardWarning(ctx, camera, player, toxicPools, poisonTrails, now) {
    if (!player) {
return;
}
    now = now || Date.now();

    let inHazard = false;
    if (Array.isArray(toxicPools)) {
      for (const p of toxicPools) {
        const dx = player.x - p.x, dy = player.y - p.y;
        if (dx * dx + dy * dy < p.radius * p.radius) {
 inHazard = true; break;
}
      }
    }
    if (!inHazard && poisonTrails) {
      for (const id in poisonTrails) {
        const t = poisonTrails[id];
        const dx = player.x - t.x, dy = player.y - t.y;
        if (dx * dx + dy * dy < t.radius * t.radius) {
 inHazard = true; break;
}
      }
    }

    if (!this._inHazardPrev && inHazard) {
this._hazardWarningStart = now;
}
    this._inHazardPrev = inHazard;
    if (!inHazard) {
return;
}

    const elapsed = now - this._hazardWarningStart;
    // Pulse: fast blink for first 1s, then slower
    const blinkRate = elapsed < 1000 ? 150 : 400;
    if (Math.floor(now / blinkRate) % 2 === 0) {
return;
}

    const sx = player.x - camera.x;
    const sy = player.y - camera.y - 36; // above player head

    ctx.save();
    const pulse = 0.8 + 0.2 * Math.sin(now / 120);
    ctx.globalAlpha = 0.9 * pulse;
    ctx.font = `bold ${Math.round(22 * pulse)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff2222';
    ctx.fillText('!', sx, sy);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

window.EffectsRenderer = EffectsRenderer;
