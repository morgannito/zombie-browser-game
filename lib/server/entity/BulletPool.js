const ObjectPool = require('../../ObjectPool');

class BulletPool {
  constructor(config) {
    this.config = config;
    this.bulletPool = new ObjectPool(
      () => ({
        id: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        playerId: null,
        zombieId: null,
        damage: 0,
        color: '#ffff00',
        piercing: 0,
        piercedZombies: [],
        explosiveRounds: false,
        explosionRadius: 0,
        explosionDamagePercent: 0,
        rocketExplosionDamage: 0,
        isAutoTurret: false,
        isRocket: false,
        isZombieBullet: false,
        isFlame: false,
        isLaser: false,
        isGrenade: false,
        isCrossbow: false,
        gravity: 0,
        lifetime: null,
        lastUpdateTime: 0,
        createdAt: 0,
        _trailInitialized: false,
        _trailX: 0,
        _trailY: 0
      }),
      bullet => {
        bullet.vx = 0;
        bullet.vy = 0;
        bullet.playerId = null;
        bullet.zombieId = null;
        bullet.damage = 0;
        bullet.piercing = 0;
        if (bullet.piercedZombies) {
bullet.piercedZombies.length = 0;
}
        bullet.explosiveRounds = false;
        bullet.explosionRadius = 0;
        bullet.explosionDamagePercent = 0;
        bullet.rocketExplosionDamage = 0;
        bullet.isAutoTurret = false;
        bullet.isRocket = false;
        bullet.isZombieBullet = false;
        bullet.isFlame = false;
        bullet.isLaser = false;
        bullet.isGrenade = false;
        bullet.isCrossbow = false;
        bullet.gravity = 0;
        bullet.lifetime = null;
        bullet.lastUpdateTime = 0;
        bullet.createdAt = 0;
        bullet._trailInitialized = false;
      },
      200
    );
  }

  createBullet(params, gameState) {
    const bullet = this.bulletPool.acquire();
    bullet.id = gameState.nextBulletId++;
    bullet.x = params.x;
    bullet.y = params.y;
    bullet.vx = params.vx;
    bullet.vy = params.vy;
    bullet.playerId = params.playerId || null;
    bullet.zombieId = params.zombieId || null;
    bullet.damage = params.damage;
    bullet.color = params.color || '#ffff00';
    bullet.size = params.size || this.config.BULLET_SIZE;
    bullet.piercing = params.piercing || 0;
    if (!bullet.piercedZombies) {
      bullet.piercedZombies = [];
    } else {
      bullet.piercedZombies.length = 0;
    }
    bullet.explosiveRounds = params.explosiveRounds || false;
    bullet.explosionRadius = params.explosionRadius || 0;
    bullet.explosionDamagePercent = params.explosionDamagePercent || 0;
    bullet.rocketExplosionDamage = params.rocketExplosionDamage || 0;
    bullet.isAutoTurret = params.isAutoTurret || false;
    bullet.isRocket = params.isRocket || false;
    bullet.isZombieBullet = params.isZombieBullet || false;
    bullet.isFlame = params.isFlame || false;
    bullet.isLaser = params.isLaser || false;
    bullet.isGrenade = params.isGrenade || false;
    bullet.isCrossbow = params.isCrossbow || false;
    bullet.gravity = params.gravity || 0;
    bullet.lifetime = params.lifetime || null;
    const now = Date.now();
    bullet.createdAt = params.createdAt || now;
    bullet.lastUpdateTime = now;
    bullet.spawnCompensationMs = params.spawnCompensationMs || 0;

    gameState.bullets[bullet.id] = bullet;
    return bullet;
  }

  destroyBullet(bulletId, gameState) {
    const bullet = gameState.bullets[bulletId];
    if (bullet) {
      this.bulletPool.release(bullet);
      delete gameState.bullets[bulletId];
    }
  }

  getStats() {
    return this.bulletPool.getStats();
  }
}

module.exports = BulletPool;
