/**
 * @fileoverview Loot update logic
 * @description Handles loot collection and expiration
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { CONFIG } = ConfigManager;

/**
 * Update loot - check expiration and player collection
 */
function updateLoot(gameState, now, io, entityManager) {
  for (const lootId in gameState.loot) {
    const loot = gameState.loot[lootId];

    if (isLootExpired(loot, now)) {
      delete gameState.loot[lootId];
      continue;
    }

    checkLootCollection(loot, lootId, gameState, io, entityManager);
  }
}

/**
 * Check if loot has expired
 */
function isLootExpired(loot, now) {
  return now > loot.lifetime;
}

/**
 * Check loot collection by players
 */
function checkLootCollection(loot, lootId, gameState, io, entityManager) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (canCollectLoot(player, loot)) {
      collectLoot(player, playerId, loot, lootId, gameState, io, entityManager);
      break;
    }
  }
}

/**
 * Check if player can collect loot
 */
function canCollectLoot(player, loot) {
  const collectRadius = CONFIG.PLAYER_SIZE + CONFIG.LOOT_SIZE + (player.goldMagnetRadius || 0);
  return player.alive &&
         player.hasNickname &&
         distance(loot.x, loot.y, player.x, player.y) < collectRadius;
}

/**
 * Collect loot and update player stats
 * BUG FIX: Added validation for loot values to prevent NaN
 */
function collectLoot(player, playerId, loot, lootId, gameState, io, entityManager) {
  // BUG FIX: Validate loot values before adding
  const goldToAdd = typeof loot.gold === 'number' && isFinite(loot.gold) ? loot.gold : 0;
  const xpToAdd = typeof loot.xp === 'number' && isFinite(loot.xp) ? loot.xp : 0;

  player.gold = (player.gold || 0) + goldToAdd;
  player.xp = (player.xp || 0) + xpToAdd;

  createParticles(loot.x, loot.y, '#ffff00', 10, entityManager);
  delete gameState.loot[lootId];

  const { handlePlayerLevelUp } = require('../player/PlayerProgression');
  handlePlayerLevelUp(player, playerId, io);
}

module.exports = {
  updateLoot
};
