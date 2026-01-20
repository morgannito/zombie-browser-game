/**
 * Environmental Particles System
 * Ambient particles like leaves, dust, debris, ash
 */

class EnvironmentalParticles {
  constructor() {
    this.particles = [];
    this.maxParticles = 100;
    this.spawnRate = 0.5; // Particles per frame
    this.enabled = true;

    // Particle type configurations
    this.particleTypes = {
      leaf: {
        color: ['#3a6b35', '#4a7d45', '#2d5016'],
        size: [3, 6],
        speed: [0.3, 0.8],
        lifetime: [300, 500],
        gravity: 0.02,
        drift: 0.5,
        rotation: true
      },
      dust: {
        color: ['rgba(200, 180, 160, 0.3)', 'rgba(180, 160, 140, 0.4)'],
        size: [1, 3],
        speed: [0.1, 0.4],
        lifetime: [200, 400],
        gravity: 0.01,
        drift: 0.3,
        rotation: false
      },
      ash: {
        color: ['rgba(100, 100, 100, 0.5)', 'rgba(80, 80, 80, 0.6)'],
        size: [2, 4],
        speed: [0.2, 0.5],
        lifetime: [400, 600],
        gravity: -0.01, // Floats up
        drift: 0.4,
        rotation: false
      },
      ember: {
        color: ['rgba(255, 100, 30, 0.8)', 'rgba(255, 150, 50, 0.7)'],
        size: [1, 2],
        speed: [0.3, 0.7],
        lifetime: [150, 300],
        gravity: -0.05, // Floats up fast
        drift: 0.2,
        rotation: false,
        glow: true
      },
      pollen: {
        color: ['rgba(255, 255, 150, 0.4)', 'rgba(200, 255, 150, 0.5)'],
        size: [1, 2],
        speed: [0.2, 0.5],
        lifetime: [400, 700],
        gravity: 0.005,
        drift: 0.6,
        rotation: false
      }
    };

    this.activeType = 'leaf'; // Default
    this.windX = 0.5;
    this.windY = 0;
  }

  /**
   * Set active particle type
   */
  setType(type) {
    if (this.particleTypes[type]) {
      this.activeType = type;
    }
  }

  /**
   * Set wind direction and strength
   */
  setWind(x, y = 0) {
    this.windX = x;
    this.windY = y;
  }

  /**
   * Update particles
   */
  update(_deltaTime = 16, camera, viewport) {
    if (!this.enabled) {
      return;
    }

    const config = this.particleTypes[this.activeType];

    // Spawn new particles
    if (this.particles.length < this.maxParticles) {
      for (let i = 0; i < this.spawnRate; i++) {
        if (Math.random() < this.spawnRate) {
          this.spawnParticle(config, camera, viewport);
        }
      }
    }

    // Update existing particles
    this.particles = this.particles.filter(p => {
      p.life--;
      p.x += p.vx + this.windX;
      p.y += p.vy + this.windY;
      p.vy += config.gravity;

      // Apply drift
      p.vx += (Math.random() - 0.5) * config.drift * 0.1;

      // Rotation
      if (config.rotation) {
        p.rotation += p.rotationSpeed;
      }

      // Fade out
      p.alpha = p.life / p.maxLife;

      // Remove if dead or off-screen
      return p.life > 0 && this.isInViewport(p, camera, viewport);
    });
  }

  spawnParticle(config, camera, viewport) {
    const sizeRange = config.size[1] - config.size[0];
    const speedRange = config.speed[1] - config.speed[0];
    const lifetimeRange = config.lifetime[1] - config.lifetime[0];

    const particle = {
      x: camera.x + Math.random() * viewport.width,
      y: camera.y - 50, // Spawn above screen
      vx: (Math.random() - 0.5) * speedRange,
      vy: config.speed[0] + Math.random() * speedRange,
      size: config.size[0] + Math.random() * sizeRange,
      color: config.color[Math.floor(Math.random() * config.color.length)],
      life: config.lifetime[0] + Math.random() * lifetimeRange,
      maxLife: config.lifetime[0] + Math.random() * lifetimeRange,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      glow: config.glow || false
    };

    this.particles.push(particle);
  }

  isInViewport(particle, camera, viewport) {
    return (
      particle.x > camera.x - 100 &&
      particle.x < camera.x + viewport.width + 100 &&
      particle.y > camera.y - 100 &&
      particle.y < camera.y + viewport.height + 100
    );
  }

  /**
   * Get particles for rendering
   */
  getParticles() {
    return this.particles;
  }

  /**
   * Toggle system
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
  }

  reset() {
    this.clear();
    this.enabled = true;
    this.activeType = 'leaf';
    this.windX = 0.5;
    this.windY = 0;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnvironmentalParticles;
}

if (typeof window !== 'undefined') {
  window.EnvironmentalParticles = EnvironmentalParticles;
}
