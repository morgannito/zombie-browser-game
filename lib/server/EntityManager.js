/**
 * ENTITY MANAGER - Facade d'orchestration des pools d'entités
 * Délègue aux pools spécialisés : BulletPool, ParticlePool, EffectPool
 * Gain: -50-60% garbage collection
 * @version 2.0.0
 */

const BulletPool = require('./entity/BulletPool');
const ParticlePool = require('./entity/ParticlePool');
const EffectPool = require('./entity/EffectPool');

class EntityManager {
  constructor(gameState, config) {
    this.gameState = gameState;
    this.config = config;

    this._bullets = new BulletPool(config);
    this._particles = new ParticlePool();
    this._effects = new EffectPool();

    // Expose pools for direct access (compat + getPoolStats)
    this.bulletPool = this._bullets.bulletPool;
    this.particlePool = this._particles.particlePool;
    this.poisonTrailPool = this._effects.poisonTrailPool;
    this.explosionPool = this._effects.explosionPool;
  }

  get _particleCount() {
    return this._particles._particleCount;
  }

  // --- Bullets ---

  createBullet(params) {
    return this._bullets.createBullet(params, this.gameState);
  }

  destroyBullet(bulletId) {
    this._bullets.destroyBullet(bulletId, this.gameState);
  }

  // --- Particles ---

  createParticles(x, y, color, count = 10) {
    this._particles.createParticles(x, y, color, count, this.gameState);
  }

  destroyParticle(particleId) {
    this._particles.destroyParticle(particleId, this.gameState);
  }

  // --- Effects (explosions + poison trails) ---

  createPoisonTrail(params) {
    return this._effects.createPoisonTrail(params, this.gameState);
  }

  destroyPoisonTrail(trailId) {
    this._effects.destroyPoisonTrail(trailId, this.gameState);
  }

  createExplosion(params) {
    return this._effects.createExplosion(params, this.gameState);
  }

  destroyExplosion(explosionId) {
    this._effects.destroyExplosion(explosionId, this.gameState);
  }

  // --- Lifecycle ---

  cleanupExpiredEntities(now) {
    for (const particleId in this.gameState.particles) {
      const particle = this.gameState.particles[particleId];
      if (now > particle.lifetime) {
        this.destroyParticle(particleId);
      }
    }
    this._effects.cleanupExpired(now, this.gameState);
  }

  // --- Stats ---

  getPoolStats() {
    return {
      bullets: this._bullets.getStats(),
      particles: this._particles.getStats(),
      poisonTrails: this._effects.getPoisonTrailStats(),
      explosions: this._effects.getExplosionStats()
    };
  }
}

module.exports = EntityManager;
