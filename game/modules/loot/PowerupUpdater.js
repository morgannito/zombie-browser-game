/**
 * @fileoverview Powerup update logic
 * @description Handles powerup collection and expiration
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { CONFIG, POWERUP_TYPES } = ConfigManager;

/**
 * Update powerups - check expiration and player collection
 */
function updatePowerups(gameState, now, entityManager) {
  for (let powerupId in gameState.powerups) {
    const powerup = gameState.powerups[powerupId];

    if (isPowerupExpired(powerup, now)) {
      delete gameState.powerups[powerupId];
      continue;
    }

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
 * Check powerup collection by players
 */
function checkPowerupCollection(powerup, powerupId, gameState, entityManager) {
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (canCollectPowerup(player, powerup)) {
      collectPowerup(player, powerup, powerupId, gameState, entityManager);
      break;
    }
  }
}

/**
 * Check if player can collect powerup
 */
function canCollectPowerup(player, powerup) {
  return player.alive &&
         player.hasNickname &&
         distance(powerup.x, powerup.y, player.x, player.y) < CONFIG.PLAYER_SIZE + CONFIG.POWERUP_SIZE;
}

/**
 * Collect powerup and apply effect
 */
function collectPowerup(player, powerup, powerupId, gameState, entityManager) {
  POWERUP_TYPES[powerup.type].effect(player);
  delete gameState.powerups[powerupId];

  createParticles(powerup.x, powerup.y, POWERUP_TYPES[powerup.type].color, 12, entityManager);
}

module.exports = {
  updatePowerups
};
