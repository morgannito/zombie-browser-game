/**
 * PROGRESSION SOCKET HANDLERS
 * Handles account progression events (XP gain, skill loading)
 * @version 1.0.0
 */

const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize progression socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} gameState - Game state
 * @param {Object} container - DI container
 */
function initProgressionHandlers(io, gameState, container) {
  const accountProgressionService = container.get('accountProgressionService');

  /**
   * Handle player death - award account XP
   * Called when a player dies in the game
   */
  async function handlePlayerDeath(socket, player, playerId) {
    try {
      if (!player || !playerId) {
        return;
      }

      // Calculate survival time if not set
      if (!player.survivalTime && player.gameStartTime) {
        player.survivalTime = Math.floor((Date.now() - player.gameStartTime) / 1000);
      }

      // Award account XP
      const result = await accountProgressionService.handlePlayerDeath(player, playerId);

      if (result && result.success) {
        // Notify player of XP gain and level ups
        socket.emit('accountXPGained', {
          xpEarned: result.levelsGained > 0 ? result.xpForNext : result.currentXP,
          levelsGained: result.levelsGained,
          skillPointsGained: result.skillPointsGained,
          newLevel: result.newLevel,
          progression: result.progression
        });

        logger.info('Player received account XP', {
          playerId,
          xpEarned: result.currentXP,
          levelsGained: result.levelsGained,
          newLevel: result.newLevel
        });
      }
    } catch (error) {
      logger.error('Failed to handle player death for progression', {
        playerId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Load player's skill bonuses when they join
   */
  async function loadPlayerSkillBonuses(playerId) {
    try {
      const bonuses = await accountProgressionService.getPlayerSkillBonuses(playerId);
      return bonuses;
    } catch (error) {
      logger.error('Failed to load player skill bonuses', {
        playerId,
        error: error.message
      });
      return accountProgressionService.getDefaultBonuses();
    }
  }

  return {
    handlePlayerDeath,
    loadPlayerSkillBonuses
  };
}

module.exports = initProgressionHandlers;
