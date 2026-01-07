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
  for (let lootId in gameState.loot) {
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
  for (let playerId in gameState.players) {
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
 */
function collectLoot(player, playerId, loot, lootId, gameState, io, entityManager) {
  player.gold += loot.gold;
  player.xp += loot.xp;

  createParticles(loot.x, loot.y, '#ffff00', 10, entityManager);
  delete gameState.loot[lootId];

  const { handlePlayerLevelUp } = require('../player/PlayerProgression');
  handlePlayerLevelUp(player, playerId, io);
}

module.exports = {
  updateLoot
};
