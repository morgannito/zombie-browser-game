const ObjectPool = require('../../ObjectPool');

const MAX_PARTICLES = 200;

class ParticlePool {
  constructor() {
    this.particlePool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: '#ffffff',
        lifetime: 0,
        size: 3
      }),
      particle => {
        particle.vx = 0;
        particle.vy = 0;
        particle.lifetime = 0;
      },
      500
    );
    this._particleCount = 0;
  }

  createParticles(x, y, color, count = 10, gameState) {
    const overflow = this._particleCount + count - MAX_PARTICLES;
    if (overflow > 0) {
      const particleIds = Object.keys(gameState.particles);
      const toPurge = Math.min(overflow, particleIds.length);
      for (let p = 0; p < toPurge; p++) {
        this.destroyParticle(particleIds[p], gameState);
      }
    }

    const allowedCount = Math.min(count, MAX_PARTICLES - this._particleCount);
    const now = Date.now();

    for (let i = 0; i < allowedCount; i++) {
      const particle = this.particlePool.acquire();
      particle.id = gameState.nextParticleId++;
      particle.x = x;
      particle.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.color = color;
      particle.lifetime = now + 500;
      particle.size = Math.random() * 3 + 2;

      gameState.particles[particle.id] = particle;
      this._particleCount++;
    }
  }

  destroyParticle(particleId, gameState) {
    const particle = gameState.particles[particleId];
    if (particle) {
      this.particlePool.release(particle);
      delete gameState.particles[particleId];
      this._particleCount--;
    }
  }

  getStats() {
    return this.particlePool.getStats();
  }
}

module.exports = ParticlePool;
