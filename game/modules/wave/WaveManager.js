/**
 * @fileoverview Wave management
 * @description Handles new wave transitions
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { CONFIG } = ConfigManager;

/**
 * Handle new wave when boss is killed
 */
function handleNewWave(gameState, io, zombieManager) {
  incrementWave(gameState);
  restartSpawner(zombieManager);
  notifyPlayers(gameState, io);
  rewardSurvivors(gameState);
}

/**
 * Increment wave counter and reset trackers
 */
function incrementWave(gameState) {
  gameState.wave++;
  gameState.bossSpawned = false;
  gameState.zombiesKilledThisWave = 0;
  gameState.zombiesSpawnedThisWave = 0;
}

/**
 * Restart zombie spawner for new wave
 */
function restartSpawner(zombieManager) {
  zombieManager.restartZombieSpawner();
}

/**
 * Notify all players of new wave
 */
function notifyPlayers(gameState, io) {
  const effectiveWave = Math.min(gameState.wave, 130);

  io.emit('newWave', {
    wave: gameState.wave,
    zombiesCount: CONFIG.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7
  });
}

/**
 * Reward surviving players
 */
function rewardSurvivors(gameState) {
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (player.alive) {
      player.health = Math.min(player.health + 50, player.maxHealth);
      player.gold += 50;
    }
  }
}

module.exports = {
  handleNewWave
};
