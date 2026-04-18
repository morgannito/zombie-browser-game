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

  /**
   * Acquire a bullet from the pool and register it in gameState.bullets.
   * @param {Object} params - See BulletPool.createBullet for shape
   * @returns {Object} The bullet entity
   */
  createBullet(params) {
    return this._bullets.createBullet(params, this.gameState);
  }

  /**
   * Release a bullet back to the pool and remove it from gameState.bullets.
   * @param {number} bulletId
   */
  destroyBullet(bulletId) {
    this._bullets.destroyBullet(bulletId, this.gameState);
  }

  // --- Particles ---

  /**
   * Spawn up to `count` particles at (x, y). Oldest particles are evicted
   * when the MAX_PARTICLES ceiling would be exceeded.
   * @param {number} x
   * @param {number} y
   * @param {string} color - CSS colour string
   * @param {number} [count=10]
   */
  createParticles(x, y, color, count = 10) {
    this._particles.createParticles(x, y, color, count, this.gameState);
  }

  /**
   * Release a particle back to the pool.
   * @param {number} particleId
   */
  destroyParticle(particleId) {
    this._particles.destroyParticle(particleId, this.gameState);
  }

  // --- Effects (explosions + poison trails) ---

  /**
   * Spawn a poison trail and register it in gameState.poisonTrails.
   * @param {Object} params - { x, y, radius, damage, duration, createdAt }
   * @returns {Object} The trail entity
   */
  createPoisonTrail(params) {
    return this._effects.createPoisonTrail(params, this.gameState);
  }

  /**
   * Remove a poison trail and clean up per-player damage tracking.
   * @param {number} trailId
   */
  destroyPoisonTrail(trailId) {
    this._effects.destroyPoisonTrail(trailId, this.gameState);
  }

  /**
   * Spawn an explosion and register it in gameState.explosions.
   * @param {Object} params - { x, y, radius, isRocket, createdAt, duration? }
   * @returns {Object} The explosion entity
   */
  createExplosion(params) {
    return this._effects.createExplosion(params, this.gameState);
  }

  /**
   * Release an explosion back to the pool.
   * @param {number} explosionId
   */
  destroyExplosion(explosionId) {
    this._effects.destroyExplosion(explosionId, this.gameState);
  }

  // --- Lifecycle ---

  /**
   * Evict expired particles and effects from the game state and return them
   * to their respective pools. Call once per server tick.
   * @param {number} now - Current timestamp (Date.now())
   */
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

  /**
   * Return pool utilisation stats for all entity types.
   * @returns {{ bullets: Object, particles: Object, poisonTrails: Object, explosions: Object }}
   */
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
