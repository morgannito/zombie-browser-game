/**
 * @fileoverview Powerup update logic
 * @description Handles powerup collection and expiration
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distanceSquared } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');
const logger = require('../../../infrastructure/logging/Logger');

const { CONFIG, POWERUP_TYPES } = ConfigManager;

// Magnet interpolation speed (same constant as loot for consistency)
const MAGNET_LERP = 0.12;

/**
 * Update powerups - check expiration, magnet attract, and player collection
 */
function updatePowerups(gameState, now, entityManager) {
  for (const powerupId in gameState.powerups) {
    const powerup = gameState.powerups[powerupId];

    if (isPowerupExpired(powerup, now)) {
      delete gameState.powerups[powerupId];
      continue;
    }

    applyMagnetAttract(powerup, gameState);

    if (!gameState.powerups[powerupId]) {
continue;
} // collected during magnet step

    checkPowerupCollection(powerup, powerupId, gameState, entityManager);
  }
}

/**
 * Check if powerup has expired
 */
function isPowerupExpired(powerup, now) {
  return now > powerup.lifetime;
}

/**
 * Smooth magnet interpolation toward nearest player with goldMagnetRadius
 */
function applyMagnetAttract(powerup, gameState) {
  let nearestPlayer = null;
  let nearestDistSq = Infinity;
  const baseRadius = CONFIG.PLAYER_SIZE + CONFIG.POWERUP_SIZE;

  for (const playerId in gameState.players) {
    /** @type {import('../../../types/jsdoc-types').PlayerState} */
    const player = gameState.players[playerId];
    if (!player.alive || !player.hasNickname || !player.goldMagnetRadius) {
continue;
}
    const magnetRadius = baseRadius + player.goldMagnetRadius;
    const distSq = distanceSquared(powerup.x, powerup.y, player.x, player.y);
    if (distSq < magnetRadius * magnetRadius && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestPlayer = player;
    }
  }

  if (!nearestPlayer) {
return;
}
  powerup.x += (nearestPlayer.x - powerup.x) * MAGNET_LERP;
  powerup.y += (nearestPlayer.y - powerup.y) * MAGNET_LERP;
}

/**
 * Check powerup collection by players using distanceSquared to avoid sqrt
 */
function checkPowerupCollection(powerup, powerupId, gameState, entityManager) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (canCollectPowerup(player, powerup)) {
      collectPowerup(player, powerup, powerupId, gameState, entityManager);
      break;
    }
  }
}

/**
 * Check if player can collect powerup (distanceSquared — no sqrt)
 */
function canCollectPowerup(player, powerup) {
  const r = CONFIG.PLAYER_SIZE + CONFIG.POWERUP_SIZE;
  return (
    player.alive &&
    player.hasNickname &&
    distanceSquared(powerup.x, powerup.y, player.x, player.y) < r * r
  );
}

/**
 * Collect powerup - atomic delete before applying to prevent double pickup
 */
function collectPowerup(player, powerup, powerupId, gameState, entityManager) {
  if (!gameState.powerups[powerupId]) {
return;
} // already collected this tick

  const powerupType = POWERUP_TYPES[powerup.type];
  if (!powerupType || typeof powerupType.effect !== 'function') {
    logger.error('[POWERUP] Invalid powerup type', { type: powerup.type });
    delete gameState.powerups[powerupId];
    return;
  }

  // Atomic remove before effect to prevent double pickup
  delete gameState.powerups[powerupId];
  powerupType.effect(player);

  createParticles(powerup.x, powerup.y, powerupType.color || '#ffffff', 12, entityManager);
}

module.exports = {
  updatePowerups
};
