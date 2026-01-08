/**
 * ACCOUNT PROGRESSION SERVICE
 * Service layer for managing account progression integration with gameplay
 * @version 1.0.0
 */

const logger = require('../infrastructure/Logger');
const AddAccountXPUseCase = require('./use-cases/AddAccountXPUseCase');

class AccountProgressionService {
  constructor(progressionRepository) {
    this.progressionRepository = progressionRepository;
    this.addAccountXPUseCase = new AddAccountXPUseCase(progressionRepository);
  }

  /**
   * Handle player death - award XP based on performance
   * @param {Object} player - Player object from game state
   * @param {String} playerId - Player UUID (for persistence)
   * @returns {Promise<Object>} - Progression result
   */
  async handlePlayerDeath(player, playerId) {
    try {
      // Calculate game stats
      const gameStats = {
        kills: player.kills || 0,
        zombiesKilled: player.zombiesKilled || 0,
        wave: player.wave || 1,
        level: player.level || 1,
        survivalTimeSeconds: player.survivalTime || 0,
        bossKills: player.bossKills || 0,
        comboMax: player.maxCombo || 0,
        score: player.score || 0,
        goldEarned: player.goldEarned || 0
      };

      // Calculate XP earned
      const xpEarned = AddAccountXPUseCase.calculateXPFromGameStats(gameStats);

      // Add XP to account
      const result = await this.addAccountXPUseCase.execute({
        playerId,
        xpEarned,
        gameStats
      });

      logger.info('Player death processed', {
        playerId,
        xpEarned,
        levelsGained: result.levelsGained,
        newLevel: result.newLevel
      });

      return result;
    } catch (error) {
      logger.error('Failed to handle player death', {
        playerId,
        error: error.message
      });
      // Don't throw - we don't want to break gameplay if progression fails
      return null;
    }
  }

  /**
   * Get player's active skill bonuses
   * @param {String} playerId - Player UUID
   * @returns {Promise<Object>} - Active skill effects
   */
  async getPlayerSkillBonuses(playerId) {
    try {
      const progression = await this.progressionRepository.findByPlayerId(playerId);

      if (!progression || progression.unlockedSkills.length === 0) {
        return this.getDefaultBonuses();
      }

      // Get all unlocked skills
      const skillPromises = progression.unlockedSkills.map(skillId =>
        this.progressionRepository.getSkillById(skillId)
      );

      const skills = await Promise.all(skillPromises);

      // Aggregate skill effects
      const bonuses = this.getDefaultBonuses();

      for (const skill of skills) {
        if (!skill || !skill.effects) {
          continue;
        }

        // Merge skill effects
        Object.keys(skill.effects).forEach(key => {
          if (typeof bonuses[key] === 'number') {
            bonuses[key] += skill.effects[key];
          } else {
            bonuses[key] = skill.effects[key];
          }
        });
      }

      // Add prestige bonuses
      const prestigeBonuses = progression.getPrestigeBonuses();
      bonuses.xpMultiplier = (bonuses.xpMultiplier || 1.0) + prestigeBonuses.xpBonus;
      bonuses.goldMultiplier = (bonuses.goldMultiplier || 1.0) + prestigeBonuses.goldBonus;
      bonuses.damageMultiplier = (bonuses.damageMultiplier || 1.0) + prestigeBonuses.damageBonus;
      bonuses.maxHealthBonus = (bonuses.maxHealthBonus || 0) + prestigeBonuses.healthBonus;
      bonuses.startingGold = (bonuses.startingGold || 0) + prestigeBonuses.startingGold;

      return bonuses;
    } catch (error) {
      logger.error('Failed to get player skill bonuses', {
        playerId,
        error: error.message
      });
      return this.getDefaultBonuses();
    }
  }

  /**
   * Get default bonuses (no skills unlocked)
   * @returns {Object}
   */
  getDefaultBonuses() {
    return {
      // Multipliers
      damageMultiplier: 0,
      speedMultiplier: 0,
      fireRateMultiplier: 0,
      xpMultiplier: 0,
      goldMultiplier: 0,
      goldRadiusMultiplier: 0,
      lootQuality: 0,
      rarityBonus: 0,

      // Flat bonuses
      maxHealthBonus: 0,
      startingGold: 0,
      regeneration: 0,
      piercing: 0,
      autoTurrets: 0,
      maxShield: 0,
      shieldRegen: 0,

      // Percentages
      critChance: 0,
      critMultiplier: 1.0,
      dodgeChance: 0,
      lifeSteal: 0,
      thornsDamage: 0,

      // Booleans
      explosiveRounds: false,
      damageImmunity: false,
      secondChance: false,

      // Special
      multishotCount: 0,
      berserkerDamage: 0,
      berserkerSpeed: 0,
      berserkerThreshold: 0.3,
      immunityCooldown: 15000
    };
  }
}

module.exports = AccountProgressionService;
