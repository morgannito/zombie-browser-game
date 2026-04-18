/**
 * @fileoverview Loot update logic
 * @description Handles loot collection and expiration
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distanceSquared } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');
const { handlePlayerLevelUp } = require('../../../contexts/player/modules/PlayerProgression');

const { CONFIG } = ConfigManager;

// Magnet interpolation speed (fraction of gap closed per tick at 60fps)
const MAGNET_LERP = 0.12;

/**
 * Update loot - check expiration, magnet attract, and player collection
 */
function updateLoot(gameState, now, io, entityManager) {
  for (const lootId in gameState.loot) {
    const loot = gameState.loot[lootId];

    if (isLootExpired(loot, now)) {
      delete gameState.loot[lootId];
      continue;
    }

    applyMagnetAttract(loot, gameState);

    if (!gameState.loot[lootId]) {
continue;
} // collected during magnet step

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
 * Smooth magnet interpolation toward nearest player with goldMagnetRadius
 */
function applyMagnetAttract(loot, gameState) {
  let nearestPlayer = null;
  let nearestDistSq = Infinity;
  const baseRadius = CONFIG.PLAYER_SIZE + CONFIG.LOOT_SIZE;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || !player.hasNickname || !player.goldMagnetRadius) {
continue;
}
    const magnetRadius = baseRadius + player.goldMagnetRadius;
    const distSq = distanceSquared(loot.x, loot.y, player.x, player.y);
    if (distSq < magnetRadius * magnetRadius && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestPlayer = player;
    }
  }

  if (!nearestPlayer) {
return;
}
  loot.x += (nearestPlayer.x - loot.x) * MAGNET_LERP;
  loot.y += (nearestPlayer.y - loot.y) * MAGNET_LERP;
}

/**
 * Check loot collection by players using distanceSquared to avoid sqrt
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
 * Check if player can collect loot (distanceSquared — no sqrt)
 */
function canCollectLoot(player, loot) {
  const r = CONFIG.PLAYER_SIZE + CONFIG.LOOT_SIZE;
  const rSq = r * r;
  return (
    player.alive &&
    player.hasNickname &&
    distanceSquared(loot.x, loot.y, player.x, player.y) < rSq
  );
}

/**
 * Collect loot - atomic delete before applying to prevent double pickup
 */
function collectLoot(player, playerId, loot, lootId, gameState, io, entityManager) {
  if (!gameState.loot[lootId]) {
return;
} // already collected this tick

  // Atomic remove first
  delete gameState.loot[lootId];

  const goldToAdd = typeof loot.gold === 'number' && isFinite(loot.gold) ? loot.gold : 0;
  const xpToAdd = typeof loot.xp === 'number' && isFinite(loot.xp) ? loot.xp : 0;

  player.gold = (player.gold || 0) + goldToAdd;
  player.xp = (player.xp || 0) + xpToAdd;

  createParticles(loot.x, loot.y, '#ffff00', 10, entityManager);
  handlePlayerLevelUp(player, playerId, io);
}

module.exports = {
  updateLoot
};
