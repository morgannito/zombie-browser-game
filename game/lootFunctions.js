/**
 * @fileoverview Loot and visual effects functions
 * @description Provides functions for:
 * - Power-up spawning
 * - Loot (gold/XP) creation
 * - Particle effects
 * - Explosion effects
 */

const ConfigManager = require('../lib/server/ConfigManager');
const { CONFIG, POWERUP_TYPES } = ConfigManager;

/**
 * Spawn des power-ups
 * BUG FIX: Added validation for required parameters
 * @param {Object} gameState - Game state object
 * @param {Object} roomManager - Room manager instance
 * @param {Object} perfIntegration - Performance integration instance
 * @param {Object} metricsCollector - Metrics collector instance
 */
function spawnPowerup(gameState, roomManager, perfIntegration, metricsCollector) {
  // BUG FIX: Validate required parameters
  if (!gameState || !roomManager || !perfIntegration || !metricsCollector) {
    console.error('[POWERUP] Missing required parameters for spawnPowerup');
    return;
  }

  if (typeof roomManager.checkWallCollision !== 'function') {
    console.error('[POWERUP] roomManager.checkWallCollision is not a function');
    return;
  }

  // Limite de power-ups selon le mode performance
  const powerupCount = Object.keys(gameState.powerups).length;
  if (!perfIntegration.canSpawnPowerup(powerupCount)) {
    return;
  }

  const types = Object.keys(POWERUP_TYPES);
  if (types.length === 0) {
    console.error('[POWERUP] No powerup types defined');
    return;
  }

  const type = types[Math.floor(Math.random() * types.length)];

  // Safe spawn margin: wall thickness + powerup size + buffer
  const wallThickness = CONFIG.WALL_THICKNESS || 40;
  const powerupSize = CONFIG.POWERUP_SIZE || 15;
  const spawnMargin = wallThickness + powerupSize + 10;

  let x, y;
  let attempts = 0;
  do {
    x = spawnMargin + Math.random() * (CONFIG.ROOM_WIDTH - spawnMargin * 2);
    y = spawnMargin + Math.random() * (CONFIG.ROOM_HEIGHT - spawnMargin * 2);
    attempts++;
  } while (roomManager.checkWallCollision(x, y, CONFIG.POWERUP_SIZE) && attempts < 50);

  if (attempts >= 50) {
    return;
  }

  const powerupId = gameState.nextPowerupId++;
  gameState.powerups[powerupId] = {
    id: powerupId,
    type: type,
    x: x,
    y: y,
    lifetime: Date.now() + 20000 // 20 secondes
  };

  // Tracker le spawn
  metricsCollector.incrementPowerupsSpawned();
}

/**
 * Créer du loot (pièces d'or)
 * BUG FIX: Added wall collision check to prevent loot spawning in walls
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} goldAmount - Amount of gold to drop
 * @param {number} xpAmount - Amount of XP to drop
 * @param {Object} gameState - Game state object
 */
function createLoot(x, y, goldAmount, xpAmount, gameState) {
  // BUG FIX: Validate amounts to prevent creating empty loot
  if ((goldAmount <= 0 || !isFinite(goldAmount)) && (xpAmount <= 0 || !isFinite(xpAmount))) {
    return; // Don't create loot with no rewards
  }

  // BUG FIX: Check wall collision and adjust position if needed
  let finalX = x;
  let finalY = y;

  if (gameState.roomManager && typeof gameState.roomManager.checkWallCollision === 'function') {
    // If position is in a wall, try to find a valid position nearby
    if (gameState.roomManager.checkWallCollision(x, y, CONFIG.LOOT_SIZE)) {
      // Try small offsets to find valid position
      const offsets = [
        { dx: CONFIG.LOOT_SIZE * 2, dy: 0 },
        { dx: -CONFIG.LOOT_SIZE * 2, dy: 0 },
        { dx: 0, dy: CONFIG.LOOT_SIZE * 2 },
        { dx: 0, dy: -CONFIG.LOOT_SIZE * 2 }
      ];

      for (const offset of offsets) {
        const newX = x + offset.dx;
        const newY = y + offset.dy;
        if (!gameState.roomManager.checkWallCollision(newX, newY, CONFIG.LOOT_SIZE)) {
          finalX = newX;
          finalY = newY;
          break;
        }
      }
    }
  }

  const lootId = gameState.nextLootId++;
  gameState.loot[lootId] = {
    id: lootId,
    x: finalX,
    y: finalY,
    gold: goldAmount || 0,
    xp: xpAmount || 0,
    lifetime: Date.now() + 30000 // 30 secondes
  };
}

/**
 * Créer des particules
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} color - Particle color
 * @param {number} count - Number of particles to create
 * @param {Object} entityManager - Entity manager instance
 */
function createParticles(x, y, color, count = 10, entityManager) {
  // Utiliser EntityManager avec Object Pool
  entityManager.createParticles(x, y, color, count);
}

/**
 * Créer une explosion visuelle
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Explosion radius
 * @param {boolean} isRocket - Whether this is a rocket explosion
 * @param {Object} entityManager - Entity manager instance
 */
function createExplosion(x, y, radius, isRocket = false, entityManager) {
  // Utiliser EntityManager avec Object Pool
  entityManager.createExplosion({
    x, y, radius, isRocket,
    createdAt: Date.now(),
    duration: 400
  });
}

module.exports = {
  spawnPowerup,
  createLoot,
  createParticles,
  createExplosion
};
