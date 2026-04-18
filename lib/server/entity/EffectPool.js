'use strict';

const ObjectPool = require('../../ObjectPool');

class EffectPool {
  constructor() {
    this.poisonTrailPool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        radius: 0,
        damage: 0,
        duration: 0,
        createdAt: 0
      }),
      trail => {
        trail.radius = 0;
        trail.damage = 0;
        trail.duration = 0;
      },
      100
    );

    this.explosionPool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        radius: 0,
        isRocket: false,
        createdAt: 0,
        duration: 400
      }),
      explosion => {
        explosion.radius = 0;
        explosion.isRocket = false;
        explosion.duration = 400;
      },
      50
    );
  }

  /**
   * Spawn a poison trail and register it in gameState.poisonTrails.
   * @param {{ x: number, y: number, radius: number, damage: number, duration: number, createdAt: number }} params
   * @param {Object} gameState
   * @returns {Object} The trail entity
   */
  createPoisonTrail(params, gameState) {
    const trail = this.poisonTrailPool.acquire();
    trail.id = gameState.nextPoisonTrailId++;
    trail.x = params.x;
    trail.y = params.y;
    trail.radius = params.radius;
    trail.damage = params.damage;
    trail.duration = params.duration;
    trail.createdAt = params.createdAt;

    gameState.poisonTrails[trail.id] = trail;
    return trail;
  }

  /**
   * Release a poison trail back to the pool and clean up per-player damage tracking.
   * Idempotent: safe to call with an unknown or already-destroyed trailId.
   * @param {number} trailId
   * @param {Object} gameState
   */
  destroyPoisonTrail(trailId, gameState) {
    const trail = gameState.poisonTrails[trailId];
    if (trail) {
      for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (player.lastPoisonDamageByTrail && player.lastPoisonDamageByTrail[trailId]) {
          delete player.lastPoisonDamageByTrail[trailId];
        }
      }
      this.poisonTrailPool.release(trail);
      delete gameState.poisonTrails[trailId];
    }
  }

  /**
   * Spawn an explosion and register it in gameState.explosions.
   * @param {{ x: number, y: number, radius: number, isRocket?: boolean, createdAt: number, duration?: number }} params
   * @param {Object} gameState
   * @returns {Object} The explosion entity
   */
  createExplosion(params, gameState) {
    const explosion = this.explosionPool.acquire();
    explosion.id = gameState.nextExplosionId++;
    explosion.x = params.x;
    explosion.y = params.y;
    explosion.radius = params.radius;
    explosion.isRocket = params.isRocket || false;
    explosion.createdAt = params.createdAt;
    explosion.duration = params.duration || 400;

    gameState.explosions[explosion.id] = explosion;
    return explosion;
  }

  /**
   * Release an explosion back to the pool.
   * Idempotent: safe to call with an unknown or already-destroyed explosionId.
   * @param {number} explosionId
   * @param {Object} gameState
   */
  destroyExplosion(explosionId, gameState) {
    const explosion = gameState.explosions[explosionId];
    if (explosion) {
      this.explosionPool.release(explosion);
      delete gameState.explosions[explosionId];
    }
  }

  /**
   * Evict expired explosions and poison trails, returning them to their pools.
   * Bug fix: removed unused destroyParticleFn parameter (was never called).
   * @param {number} now - Current timestamp (Date.now())
   * @param {Object} gameState
   */
  cleanupExpired(now, gameState) {
    for (const explosionId in gameState.explosions) {
      const explosion = gameState.explosions[explosionId];
      if (now - explosion.createdAt > explosion.duration) {
        this.destroyExplosion(explosionId, gameState);
      }
    }

    for (const trailId in gameState.poisonTrails) {
      const trail = gameState.poisonTrails[trailId];
      if (now - trail.createdAt > trail.duration) {
        this.destroyPoisonTrail(trailId, gameState);
      }
    }
  }

  /** @returns {Object} Poison trail pool utilisation stats */
  getPoisonTrailStats() {
    return this.poisonTrailPool.getStats();
  }

  /** @returns {Object} Explosion pool utilisation stats */
  getExplosionStats() {
    return this.explosionPool.getStats();
  }
}

module.exports = EffectPool;
