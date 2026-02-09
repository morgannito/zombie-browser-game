/**
 * EFFECTS RENDERER
 * Handles rendering of particles, explosions, poison trails, weather, lighting effects
 * @module EffectsRenderer
 * @author Claude Code
 * @version 1.0.0
 */

class EffectsRenderer {
  constructor() {
    // No persistent state needed
  }

  renderParticles(ctx, camera, particles) {
    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    if (!particles) {
      return;
    }

    for (const particleId in particles) {
      const particle = particles[particleId];
      if (!camera.isInViewport(particle.x, particle.y, 50)) {
        continue;
      }

      ctx.fillStyle = particle.color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  renderDynamicPropParticles(ctx, camera, particles) {
    if (!particles || particles.length === 0) {
      return;
    }

    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    particles.forEach(particle => {
      if (!camera.isInViewport(particle.x, particle.y, 50)) {
        return;
      }

      ctx.save();
      ctx.globalAlpha = particle.alpha || 1;

      if (typeof particle.color === 'string' && particle.color.startsWith('rgba')) {
        ctx.fillStyle = particle.color;
      } else {
        ctx.fillStyle = particle.color || '#fff';
      }

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      if (
        particle.color === '#ff6600' ||
        particle.color === '#ffaa00' ||
        particle.color === '#ffff00'
      ) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = particle.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    });
  }

  renderPoisonTrails(ctx, camera, poisonTrails, now) {
    now = now || Date.now();
    const trails = poisonTrails || {};

    for (const trailId in trails) {
      const trail = trails[trailId];
      if (!camera.isInViewport(trail.x, trail.y, trail.radius * 2)) {
        continue;
      }

      const pulseAmount = Math.sin(now / 300) * 0.1;
      const age = now - trail.createdAt;
      const fadeAmount = Math.max(0, 1 - age / trail.duration);

      ctx.fillStyle = '#22ff22';
      ctx.globalAlpha = (0.15 + pulseAmount) * fadeAmount;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#11dd11';
      ctx.globalAlpha = (0.3 + pulseAmount * 0.5) * fadeAmount;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.globalAlpha = (0.4 + pulseAmount) * fadeAmount;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }
  }

  renderToxicPools(ctx, camera, toxicPools, now) {
    if (!toxicPools || !Array.isArray(toxicPools)) {
      return;
    }

    now = now || Date.now();

    toxicPools.forEach(pool => {
      if (!camera.isInViewport(pool.x, pool.y, pool.radius * 2)) {
        return;
      }

      const pulseAmount = Math.sin(now / 200) * 0.15;
      const age = now - pool.createdAt;
      const fadeAmount = Math.max(0, 1 - age / pool.duration);

      ctx.save();

      ctx.fillStyle = '#00ff00';
      ctx.globalAlpha = (0.2 + pulseAmount) * fadeAmount;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22ff22';
      ctx.globalAlpha = (0.4 + pulseAmount * 0.8) * fadeAmount;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00dd00';
      ctx.globalAlpha = (0.6 + pulseAmount * 1.2) * fadeAmount;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.globalAlpha = (0.6 + pulseAmount * 1.5) * fadeAmount;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff00';
      ctx.globalAlpha = (0.3 + pulseAmount) * fadeAmount;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
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

  renderEnvironmentalParticles(ctx, camera, envParticles) {
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
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
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

  renderWeather(ctx, camera, weather) {
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
}

window.EffectsRenderer = EffectsRenderer;
