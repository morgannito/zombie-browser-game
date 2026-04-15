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
  if (gameState.mutatorManager) {
    gameState.mutatorManager.handleWaveChange(gameState.wave);
  }
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
  const spawnCountMultiplier = gameState.mutatorEffects?.spawnCountMultiplier || 1;
  const baseZombies = CONFIG.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7;
  const adjustedZombies = Math.max(1, Math.floor(baseZombies * spawnCountMultiplier));

  io.emit('newWave', {
    wave: gameState.wave,
    zombiesCount: adjustedZombies,
    mutators: gameState.activeMutators || [],
    nextMutatorWave: gameState.nextMutatorWave || 0
  });
}

/**
 * Reward surviving players
 */
function rewardSurvivors(gameState) {
  for (const playerId in gameState.players) {
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
