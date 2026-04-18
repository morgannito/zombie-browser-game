'use strict';

const ObjectPool = require('../../ObjectPool');

const MAX_PARTICLES = 200;

/**
 * Reset mutable fields on a particle before returning it to the pool.
 * Bug fix: color and size were not reset, causing stale field leaks on reuse.
 * @param {Object} particle
 */
function _resetParticle(particle) {
  particle.vx = 0;
  particle.vy = 0;
  particle.color = '#ffffff';
  particle.size = 3;
  particle.lifetime = 0;
}

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
      _resetParticle,
      500
    );
    this._particleCount = 0;
  }

  /**
   * Evict oldest particles when at capacity, then spawn up to `count` new ones.
   * @param {number} x
   * @param {number} y
   * @param {string} color - CSS colour string
   * @param {number} [count=10]
   * @param {Object} gameState
   */
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

  /**
   * Release a particle back to the pool.
   * Idempotent: safe to call with an unknown or already-destroyed particleId.
   * @param {number} particleId
   * @param {Object} gameState
   */
  destroyParticle(particleId, gameState) {
    const particle = gameState.particles[particleId];
    if (particle) {
      this.particlePool.release(particle);
      delete gameState.particles[particleId];
      this._particleCount--;
    }
  }

  /** @returns {Object} Pool utilisation stats */
  getStats() {
    return this.particlePool.getStats();
  }
}

module.exports = ParticlePool;
