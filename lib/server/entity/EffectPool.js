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
      },
      50
    );
  }

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

  destroyExplosion(explosionId, gameState) {
    const explosion = gameState.explosions[explosionId];
    if (explosion) {
      this.explosionPool.release(explosion);
      delete gameState.explosions[explosionId];
    }
  }

  cleanupExpired(now, gameState, destroyParticleFn) {
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

  getPoisonTrailStats() {
    return this.poisonTrailPool.getStats();
  }

  getExplosionStats() {
    return this.explosionPool.getStats();
  }
}

module.exports = EffectPool;
