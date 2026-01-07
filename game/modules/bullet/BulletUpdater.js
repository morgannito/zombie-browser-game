/**
 * @fileoverview Main bullet update logic
 * @description Updates bullet positions and handles wall collisions
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { CONFIG } = ConfigManager;

/**
 * Update all bullets
 */
function updateBullets(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  const roomManager = gameState.roomManager;

  for (let bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];

    updateBulletPosition(bullet, now);

    if (shouldDestroyBullet(bullet, now, roomManager)) {
      entityManager.destroyBullet(bulletId);
      continue;
    }

    updatePlasmaTrail(bullet, entityManager);

    if (bullet.isZombieBullet) {
      const { handleZombieBulletCollisions } = require('./BulletCollisionHandler');
      handleZombieBulletCollisions(bullet, bulletId, gameState, entityManager);
      continue;
    }

    const { handlePlayerBulletCollisions } = require('./BulletCollisionHandler');
    handlePlayerBulletCollisions(bullet, bulletId, gameState, io, collisionManager, entityManager, zombieManager, perfIntegration);
  }
}

/**
 * Update bullet position
 */
function updateBulletPosition(bullet, now) {
  bullet.x += bullet.vx;
  bullet.y += bullet.vy;

  if (bullet.gravity && bullet.gravity > 0) {
    bullet.vy += bullet.gravity;
  }
}

/**
 * Check if bullet should be destroyed
 */
function shouldDestroyBullet(bullet, now, roomManager) {
  if (bullet.lifetime && now > bullet.lifetime) {
    return true;
  }

  const shouldCheckWalls = !bullet.ignoresWalls;
  if (bullet.x < 0 || bullet.x > CONFIG.ROOM_WIDTH ||
      bullet.y < 0 || bullet.y > CONFIG.ROOM_HEIGHT ||
      (shouldCheckWalls && roomManager && roomManager.checkWallCollision(bullet.x, bullet.y, CONFIG.BULLET_SIZE))) {
    return true;
  }

  return false;
}

/**
 * Update plasma rifle trail
 */
function updatePlasmaTrail(bullet, entityManager) {
  if (bullet.isPlasmaRifle && bullet.lastTrailPosition) {
    const distSinceLastTrail = distance(bullet.x, bullet.y, bullet.lastTrailPosition.x, bullet.lastTrailPosition.y);
    if (distSinceLastTrail >= 10) {
      createParticles(bullet.x, bullet.y, bullet.color, 1, entityManager);
      bullet.lastTrailPosition = { x: bullet.x, y: bullet.y };
    }
  } else if (bullet.isPlasmaRifle && !bullet.lastTrailPosition) {
    bullet.lastTrailPosition = { x: bullet.x, y: bullet.y };
  }
}

module.exports = {
  updateBullets
};
