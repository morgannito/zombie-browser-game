const ObjectPool = require('../../ObjectPool');

/** @typedef {Object} BulletParams
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} damage
 * @property {string} [color='#ffff00']
 * @property {number} [size]
 * @property {string|null} [playerId]
 * @property {string|null} [zombieId]
 * @property {number} [piercing=0]
 * @property {boolean} [explosiveRounds=false]
 * @property {number} [explosionRadius=0]
 * @property {number} [explosionDamagePercent=0]
 * @property {number} [rocketExplosionDamage=0]
 * @property {boolean} [isAutoTurret=false]
 * @property {boolean} [isRocket=false]
 * @property {boolean} [isZombieBullet=false]
 * @property {boolean} [isFlame=false]
 * @property {boolean} [isLaser=false]
 * @property {boolean} [isGrenade=false]
 * @property {boolean} [isCrossbow=false]
 * @property {number} [gravity=0]
 * @property {number|null} [lifetime=null]
 * @property {number} [createdAt]
 * @property {number} [spawnCompensationMs=0]
 */

/** @param {Object} bullet */
function _resetBullet(bullet) {
  bullet.vx = 0;
  bullet.vy = 0;
  bullet.playerId = null;
  bullet.zombieId = null;
  bullet.damage = 0;
  bullet.color = '#ffff00';
  bullet.size = 0;
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
  bullet.spawnCompensationMs = 0;
  bullet._trailInitialized = false;
}

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
        size: 0,
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
        spawnCompensationMs: 0,
        _trailInitialized: false,
        _trailX: 0,
        _trailY: 0
      }),
      _resetBullet,
      200
    );
  }

  /**
   * Assign params onto an acquired bullet object.
   * @param {Object} bullet
   * @param {BulletParams} params
   * @param {number} defaultSize
   */
  _assignBulletParams(bullet, params, defaultSize) {
    const now = Date.now();
    bullet.x = params.x;
    bullet.y = params.y;
    bullet.vx = params.vx;
    bullet.vy = params.vy;
    bullet.playerId = params.playerId || null;
    bullet.zombieId = params.zombieId || null;
    bullet.damage = params.damage;
    bullet.color = params.color || '#ffff00';
    bullet.size = params.size || defaultSize;
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
    bullet.createdAt = params.createdAt || now;
    bullet.lastUpdateTime = now;
    bullet.spawnCompensationMs = params.spawnCompensationMs || 0;
  }

  /**
   * Acquire a bullet from the pool, assign params, and register in gameState.
   * @param {BulletParams} params
   * @param {Object} gameState
   * @returns {import('../../types/jsdoc-types').Bullet} The bullet entity
   */
  createBullet(params, gameState) {
    const bullet = this.bulletPool.acquire();
    bullet.id = gameState.nextBulletId++;
    this._assignBulletParams(bullet, params, this.config.BULLET_SIZE);
    gameState.bullets[bullet.id] = bullet;
    return bullet;
  }

  /**
   * Release a bullet back to the pool and remove it from gameState.
   * Idempotent: safe to call with an unknown or already-destroyed bulletId.
   * @param {number} bulletId
   * @param {Object} gameState
   */
  destroyBullet(bulletId, gameState) {
    const bullet = gameState.bullets[bulletId];
    if (bullet) {
      this.bulletPool.release(bullet);
      delete gameState.bullets[bulletId];
    }
  }

  /** @returns {Object} Pool utilisation stats */
  getStats() {
    return this.bulletPool.getStats();
  }
}

module.exports = BulletPool;
