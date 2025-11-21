/**
 * PROGRESSION INTEGRATION
 * Wires progression systems (XP, skills, achievements) into gameplay
 * @version 1.0.0
 */

const logger = require('../infrastructure/Logger');
const SkillEffectsApplicator = require('./SkillEffectsApplicator');

class ProgressionIntegration {
  constructor(container, io) {
    this.container = container;
    this.io = io;

    // Get services from container
    this.accountProgressionService = container.get('accountProgressionService');
    this.achievementService = container.get('achievementService');

    logger.info('ProgressionIntegration initialized');
  }

  /**
   * Apply skill bonuses when player spawns/joins
   * @param {Object} player - Player object from game state
   * @param {String} playerUUID - Player persistent UUID
   * @param {Object} CONFIG - Game config
   * @returns {Promise<Object>} - Modified player
   */
  async applySkillBonusesOnSpawn(player, playerUUID, CONFIG) {
    try {
      if (!playerUUID || !player) {
        return player;
      }

      // Load player's skill bonuses
      const bonuses = await this.accountProgressionService.getPlayerSkillBonuses(playerUUID);

      // Apply bonuses to player
      SkillEffectsApplicator.applySkillBonuses(player, bonuses, CONFIG);

      logger.info('Applied skill bonuses on spawn', {
        playerUUID,
        bonusesApplied: Object.keys(bonuses).filter(k => bonuses[k] && bonuses[k] !== 0).length
      });

      // Emit bonuses to client for UI display
      const socket = this.findPlayerSocket(player.id);
      if (socket) {
        socket.emit('skillBonusesLoaded', bonuses);
      }

      return player;
    } catch (error) {
      logger.error('Failed to apply skill bonuses on spawn', {
        playerUUID,
        error: error.message
      });
      return player;
    }
  }

  /**
   * Handle player death - award XP and check achievements
   * @param {Object} player - Player object from game state
   * @param {String} playerUUID - Player persistent UUID
   * @param {Object} sessionStats - Stats from session
   */
  async handlePlayerDeath(player, playerUUID, sessionStats = {}) {
    try {
      if (!playerUUID || !player) {
        return;
      }

      // Calculate survival time if not set
      if (!player.survivalTime && player.gameStartTime) {
        player.survivalTime = Math.floor((Date.now() - player.gameStartTime) / 1000);
      }

      // Award account XP
      const xpResult = await this.accountProgressionService.handlePlayerDeath(player, playerUUID);

      // Check and unlock achievements
      const achievementsResult = await this.achievementService.checkAndUnlockAchievements(
        playerUUID,
        sessionStats
      );

      // Notify player via socket
      const socket = this.findPlayerSocket(player.id);
      if (socket && xpResult && xpResult.success) {
        // Send XP gained notification
        socket.emit('accountXPGained', {
          xpEarned: xpResult.currentXP,
          levelsGained: xpResult.levelsGained,
          skillPointsGained: xpResult.skillPointsGained,
          newLevel: xpResult.newLevel,
          progression: xpResult.progression
        });

        // Send achievements unlocked notification
        if (achievementsResult && achievementsResult.length > 0) {
          socket.emit('achievementsUnlocked', {
            achievements: achievementsResult.map(a => a.toObject()),
            count: achievementsResult.length
          });
        }

        logger.info('Player death processed', {
          playerUUID,
          xpEarned: xpResult.currentXP,
          levelsGained: xpResult.levelsGained,
          achievementsUnlocked: achievementsResult ? achievementsResult.length : 0
        });
      }
    } catch (error) {
      logger.error('Failed to handle player death for progression', {
        playerUUID,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Update player stats with berserker/dynamic bonuses during gameplay
   * @param {Object} player - Player object
   * @returns {Object} - Player with updated stats
   */
  updateDynamicBonuses(player) {
    if (!player || !player.alive) {
      return player;
    }

    // Check and apply berserker mode
    SkillEffectsApplicator.checkBerserkerMode(player);

    return player;
  }

  /**
   * Handle incoming damage with skill effects (dodge, immunity, shield, thorns)
   * @param {Object} player - Player object
   * @param {Number} damage - Incoming damage
   * @param {Object} attacker - Attacker object (optional)
   * @returns {Object} - { actualDamage, blocked, reflected }
   */
  handleIncomingDamage(player, damage, attacker = null) {
    return SkillEffectsApplicator.handleIncomingDamage(player, damage, attacker);
  }

  /**
   * Check second chance (revive) when player would die
   * @param {Object} player - Player object
   * @returns {Boolean} - Whether player was revived
   */
  checkSecondChance(player) {
    return SkillEffectsApplicator.checkSecondChance(player);
  }

  /**
   * Apply berserker damage bonus
   * @param {Number} baseDamage - Base damage
   * @param {Object} player - Player object
   * @returns {Number} - Modified damage
   */
  applyBerserkerDamage(baseDamage, player) {
    return SkillEffectsApplicator.applyBerserkerDamage(baseDamage, player);
  }

  /**
   * Find player's socket by socket ID
   * @param {String} socketId - Socket ID
   * @returns {Socket|null}
   */
  findPlayerSocket(socketId) {
    const sockets = this.io.sockets.sockets;
    return sockets.get(socketId) || null;
  }
}

module.exports = ProgressionIntegration;
