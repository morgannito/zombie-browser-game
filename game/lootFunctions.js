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
 * @param {Object} gameState - Game state object
 * @param {Object} roomManager - Room manager instance
 * @param {Object} perfIntegration - Performance integration instance
 * @param {Object} metricsCollector - Metrics collector instance
 */
function spawnPowerup(gameState, roomManager, perfIntegration, metricsCollector) {
  // Limite de power-ups selon le mode performance
  const powerupCount = Object.keys(gameState.powerups).length;
  if (!perfIntegration.canSpawnPowerup(powerupCount)) {
    return;
  }

  const types = Object.keys(POWERUP_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];

  let x, y;
  let attempts = 0;
  do {
    x = 100 + Math.random() * (CONFIG.ROOM_WIDTH - 200);
    y = 100 + Math.random() * (CONFIG.ROOM_HEIGHT - 200);
    attempts++;
  } while (roomManager.checkWallCollision(x, y, CONFIG.POWERUP_SIZE) && attempts < 50);

  if (attempts >= 50) return;

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
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} goldAmount - Amount of gold to drop
 * @param {number} xpAmount - Amount of XP to drop
 * @param {Object} gameState - Game state object
 */
function createLoot(x, y, goldAmount, xpAmount, gameState) {
  const lootId = gameState.nextLootId++;
  gameState.loot[lootId] = {
    id: lootId,
    x: x,
    y: y,
    gold: goldAmount,
    xp: xpAmount,
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
