/**
 * Dynamic Props System
 * Animated environment props (fires, smoke, sparks, steam, etc.)
 */

class DynamicPropsSystem {
  constructor() {
    this.props = new Map();
    this.nextId = 1;

    // Prop type definitions
    this.propTypes = {
      fire: {
        name: 'Feu',
        width: 30,
        height: 40,
        particlesPerFrame: 3,
        particleLifetime: 60,
        lightRadius: 80,
        lightColor: 'rgba(255, 100, 0, 0.4)',
        damageRadius: 25,
        damagePerSecond: 5
      },
      smoke: {
        name: 'Fumée',
        width: 40,
        height: 60,
        particlesPerFrame: 2,
        particleLifetime: 120,
        lightRadius: 0,
        damageRadius: 0
      },
      sparks: {
        name: 'Étincelles',
        width: 20,
        height: 20,
        particlesPerFrame: 5,
        particleLifetime: 30,
        lightRadius: 40,
        lightColor: 'rgba(255, 200, 100, 0.3)',
        damageRadius: 0
      },
      steam: {
        name: 'Vapeur',
        width: 35,
        height: 50,
        particlesPerFrame: 2,
        particleLifetime: 90,
        lightRadius: 0,
        damageRadius: 0
      },
      torch: {
        name: 'Torche',
        width: 15,
        height: 60,
        particlesPerFrame: 2,
        particleLifetime: 40,
        lightRadius: 100,
        lightColor: 'rgba(255, 150, 50, 0.5)',
        damageRadius: 0
      }
    };

    this.particles = [];
  }

  /**
   * Spawn dynamic props on map
   */
  spawnProps(mapWidth, mapHeight, density = 0.3) {
    const types = Object.keys(this.propTypes);
    const totalProps = Math.floor(density * 30); // ~10 dynamic props
    const margin = 200;

    for (let i = 0; i < totalProps; i++) {
      // Weighted selection (fires more common)
      let typeKey;
      const rand = Math.random();
      if (rand < 0.4) typeKey = 'fire';
      else if (rand < 0.6) typeKey = 'smoke';
      else if (rand < 0.75) typeKey = 'sparks';
      else if (rand < 0.85) typeKey = 'steam';
      else typeKey = 'torch';

      let x, y;
      let attempts = 0;
      do {
        x = margin + Math.random() * (mapWidth - margin * 2);
        y = margin + Math.random() * (mapHeight - margin * 2);
        attempts++;
      } while (this.isNearCenter(x, y, mapWidth, mapHeight, 300) && attempts < 10);

      if (attempts >= 10) continue;

      this.createProp(typeKey, x, y);
    }
  }

  isNearCenter(x, y, mapWidth, mapHeight, radius) {
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }

  createProp(typeKey, x, y) {
    const type = this.propTypes[typeKey];
    if (!type) return null;

    const prop = {
      id: this.nextId++,
      type: typeKey,
      x,
      y,
      width: type.width,
      height: type.height,
      particlesPerFrame: type.particlesPerFrame,
      particleLifetime: type.particleLifetime,
      lightRadius: type.lightRadius,
      lightColor: type.lightColor,
      damageRadius: type.damageRadius,
      damagePerSecond: type.damagePerSecond,
      frameCount: 0,
      intensity: 0.8 + Math.random() * 0.4, // 0.8-1.2 intensity variance
      ...type
    };

    this.props.set(prop.id, prop);
    return prop;
  }

  /**
   * Update dynamic props and generate particles
   */
  update(deltaTime = 16) {
    // Update particles
    this.particles = this.particles.filter(p => {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.size *= 0.98; // Shrink over time
      p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });

    // Generate new particles from props
    this.props.forEach(prop => {
      prop.frameCount++;
      this.generateParticles(prop);
    });
  }

  generateParticles(prop) {
    const count = prop.particlesPerFrame * prop.intensity;

    for (let i = 0; i < count; i++) {
      if (Math.random() > prop.intensity) continue;

      let particle;

      switch (prop.type) {
        case 'fire':
          particle = this.createFireParticle(prop);
          break;
        case 'smoke':
          particle = this.createSmokeParticle(prop);
          break;
        case 'sparks':
          particle = this.createSparkParticle(prop);
          break;
        case 'steam':
          particle = this.createSteamParticle(prop);
          break;
        case 'torch':
          particle = this.createTorchParticle(prop);
          break;
      }

      if (particle) {
        this.particles.push(particle);
      }
    }
  }

  createFireParticle(prop) {
    return {
      x: prop.x + (Math.random() - 0.5) * prop.width,
      y: prop.y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -1 - Math.random() * 2,
      size: 3 + Math.random() * 5,
      color: Math.random() > 0.5 ? '#ff6600' : '#ffaa00',
      life: prop.particleLifetime,
      maxLife: prop.particleLifetime,
      alpha: 1,
      gravity: -0.02
    };
  }

  createSmokeParticle(prop) {
    return {
      x: prop.x + (Math.random() - 0.5) * prop.width,
      y: prop.y - 10,
      vx: (Math.random() - 0.5) * 1,
      vy: -0.5 - Math.random() * 0.5,
      size: 8 + Math.random() * 10,
      color: `rgba(100, 100, 100, ${0.3 + Math.random() * 0.3})`,
      life: prop.particleLifetime,
      maxLife: prop.particleLifetime,
      alpha: 0.6,
      gravity: -0.01
    };
  }

  createSparkParticle(prop) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;

    return {
      x: prop.x,
      y: prop.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      size: 1 + Math.random() * 2,
      color: Math.random() > 0.7 ? '#ffff00' : '#ffaa00',
      life: prop.particleLifetime,
      maxLife: prop.particleLifetime,
      alpha: 1,
      gravity: 0.1
    };
  }

  createSteamParticle(prop) {
    return {
      x: prop.x + (Math.random() - 0.5) * prop.width * 0.5,
      y: prop.y,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.8 - Math.random() * 0.5,
      size: 6 + Math.random() * 8,
      color: 'rgba(200, 200, 220, 0.4)',
      life: prop.particleLifetime,
      maxLife: prop.particleLifetime,
      alpha: 0.5,
      gravity: -0.015
    };
  }

  createTorchParticle(prop) {
    return {
      x: prop.x + (Math.random() - 0.5) * 8,
      y: prop.y - prop.height / 2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -1.5 - Math.random(),
      size: 2 + Math.random() * 4,
      color: Math.random() > 0.3 ? '#ff8800' : '#ffcc00',
      life: prop.particleLifetime,
      maxLife: prop.particleLifetime,
      alpha: 1,
      gravity: -0.03
    };
  }

  /**
   * Check if entity is in damage radius
   */
  checkDamage(x, y) {
    for (const prop of this.props.values()) {
      if (prop.damageRadius === 0) continue;

      const dx = x - prop.x;
      const dy = y - prop.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < prop.damageRadius) {
        return {
          damage: prop.damagePerSecond / 60, // Per frame
          type: prop.type
        };
      }
    }
    return null;
  }

  getProps() {
    return Array.from(this.props.values());
  }

  getParticles() {
    return this.particles;
  }

  getPropsInViewport(camera, viewport) {
    const buffer = 150;
    const minX = camera.x - buffer;
    const maxX = camera.x + viewport.width + buffer;
    const minY = camera.y - buffer;
    const maxY = camera.y + viewport.height + buffer;

    return this.getProps().filter(prop =>
      prop.x > minX && prop.x < maxX && prop.y > minY && prop.y < maxY
    );
  }

  clear() {
    this.props.clear();
    this.particles = [];
    this.nextId = 1;
  }

  reset() {
    this.clear();
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynamicPropsSystem;
}

if (typeof window !== 'undefined') {
  window.DynamicPropsSystem = DynamicPropsSystem;
}
