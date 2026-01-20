/**
 * @fileoverview Main bullet update logic
 * @description Updates bullet positions and handles wall collisions
 *
 * PHYSICS FIXES:
 * - Added deltaTime-based movement for consistent speed regardless of frame rate
 * - Added swept collision detection to prevent fast bullets from tunneling through targets
 * - Added sub-step collision for high-speed projectiles (sniper, laser)
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { CONFIG } = ConfigManager;

// Target frame time (60 FPS = 16.67ms per frame)
const TARGET_FRAME_TIME = 1000 / 60;

// Maximum distance a bullet can travel per substep (prevents tunneling)
// Should be smaller than the smallest target (ZOMBIE_SIZE = 25, PLAYER_SIZE = 20)
const MAX_SUBSTEP_DISTANCE = 15;

// LATENCY OPTIMIZATION: Cache require to avoid repeated lookups
const { handleZombieBulletCollisions, handlePlayerBulletCollisions } = require('./BulletCollisionHandler');

/**
 * Update all bullets
 * LATENCY OPTIMIZATION: Optimized loop with early returns + cached requires
 *
 * PHYSICS FIX: Now calculates deltaTime for frame-rate independent movement
 */
function updateBullets(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  const roomManager = gameState.roomManager;
  const bullets = gameState.bullets;

  // LATENCY OPTIMIZATION: for-of faster than for-in for dense arrays/objects
  const bulletIds = Object.keys(bullets);
  for (let i = 0; i < bulletIds.length; i++) {
    const bulletId = bulletIds[i];
    const bullet = bullets[bulletId];

    // Fast path: destroyed check first
    if (!bullet) {
      continue;
    }

    // PHYSICS FIX: Calculate deltaTime for this bullet
    const lastUpdate = bullet.lastUpdateTime || bullet.createdAt || now;
    const deltaTime = Math.min(now - lastUpdate, 100); // Cap at 100ms to prevent huge jumps after lag
    const deltaMultiplier = deltaTime / TARGET_FRAME_TIME;
    bullet.lastUpdateTime = now;

    // PHYSICS FIX: Use swept collision for fast bullets to prevent tunneling
    const destroyed = updateBulletPositionWithCollision(
      bullet,
      bulletId,
      deltaMultiplier,
      now,
      roomManager,
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      perfIntegration
    );

    if (destroyed) {
      continue;
    }

    if (shouldDestroyBullet(bullet, now, roomManager)) {
      entityManager.destroyBullet(bulletId);
      continue;
    }

    updatePlasmaTrail(bullet, entityManager);
  }
}

/**
 * Update bullet position with swept collision detection
 * PHYSICS FIX: Prevents fast bullets from tunneling through targets
 *
 * @param {Object} bullet - Bullet entity
 * @param {string} bulletId - Bullet ID
 * @param {number} deltaMultiplier - Delta time multiplier (1.0 = normal frame)
 * @param {number} now - Current timestamp
 * @param {Object} roomManager - Room manager for wall collision
 * @param {Object} gameState - Game state
 * @param {Object} io - Socket.io instance
 * @param {Object} collisionManager - Collision manager
 * @param {Object} entityManager - Entity manager
 * @param {Object} zombieManager - Zombie manager
 * @param {Object} perfIntegration - Performance integration
 * @returns {boolean} True if bullet was destroyed during movement
 */
function updateBulletPositionWithCollision(
  bullet,
  bulletId,
  deltaMultiplier,
  now,
  roomManager,
  gameState,
  io,
  collisionManager,
  entityManager,
  zombieManager,
  perfIntegration
) {
  // Calculate total movement for this frame
  const totalVx = bullet.vx * deltaMultiplier;
  const totalVy = bullet.vy * deltaMultiplier;

  // Apply gravity if applicable (scaled by deltaMultiplier)
  if (bullet.gravity && bullet.gravity > 0) {
    bullet.vy += bullet.gravity * deltaMultiplier;
  }

  // Calculate total distance to travel
  const totalDistance = Math.sqrt(totalVx * totalVx + totalVy * totalVy);

  // For slow bullets or very small movements, use simple position update
  if (totalDistance <= MAX_SUBSTEP_DISTANCE) {
    bullet.x += totalVx;
    bullet.y += totalVy;

    // Check collision at final position
    return checkBulletCollisionAtPosition(
      bullet,
      bulletId,
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      perfIntegration
    );
  }

  // PHYSICS FIX: For fast bullets, use substep collision detection
  // Calculate number of substeps needed
  const numSubsteps = Math.ceil(totalDistance / MAX_SUBSTEP_DISTANCE);
  const substepVx = totalVx / numSubsteps;
  const substepVy = totalVy / numSubsteps;

  // Move in substeps, checking collision at each step
  for (let step = 0; step < numSubsteps; step++) {
    bullet.x += substepVx;
    bullet.y += substepVy;

    // Check wall collision at intermediate position
    const shouldCheckWalls = !bullet.ignoresWalls;
    if (bullet.x < 0 || bullet.x > CONFIG.ROOM_WIDTH ||
        bullet.y < 0 || bullet.y > CONFIG.ROOM_HEIGHT ||
        (shouldCheckWalls && roomManager && roomManager.checkWallCollision(bullet.x, bullet.y, CONFIG.BULLET_SIZE))) {
      entityManager.destroyBullet(bulletId);
      return true;
    }

    // Check entity collision at intermediate position
    const destroyed = checkBulletCollisionAtPosition(
      bullet,
      bulletId,
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      perfIntegration
    );

    if (destroyed) {
      return true;
    }
  }

  return false;
}

/**
 * Check bullet collision at current position
 * @returns {boolean} True if bullet was destroyed
 */
function checkBulletCollisionAtPosition(
  bullet,
  bulletId,
  gameState,
  io,
  collisionManager,
  entityManager,
  zombieManager,
  perfIntegration
) {
  // Check if bullet still exists (may have been destroyed by previous collision)
  if (!gameState.bullets[bulletId]) {
    return true;
  }

  if (bullet.isZombieBullet) {
    handleZombieBulletCollisions(bullet, bulletId, gameState, entityManager);
  } else {
    handlePlayerBulletCollisions(bullet, bulletId, gameState, io, collisionManager, entityManager, zombieManager, perfIntegration);
  }

  // Check if bullet was destroyed by collision handler
  return !gameState.bullets[bulletId];
}

/**
 * Legacy update bullet position (kept for reference)
 * @deprecated Use updateBulletPositionWithCollision instead
 */
function _updateBulletPosition(bullet, _now) {
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
