/**
 * ACCOUNT PROGRESSION SERVICE
 * Service layer for managing account progression integration with gameplay
 * @version 1.0.0
 */

const logger = require('../../infrastructure/logging/Logger');
const AddAccountXPUseCase = require('./use-cases/AddAccountXPUseCase');
const SkillBonusCache = require('../server/SkillBonusCache');

class AccountProgressionService {
  constructor(progressionRepository, cache = new SkillBonusCache()) {
    this.progressionRepository = progressionRepository;
    this.addAccountXPUseCase = new AddAccountXPUseCase(progressionRepository);
    this._cache = cache;
    // Per-player locks to prevent concurrent XP grants → double level-up
    this._xpLocks = new Set();
  }

  /**
   * Handle player death - award XP based on performance
   * @param {Object} player - Player object from game state
   * @param {String} playerId - Player UUID (for persistence)
   * @returns {Promise<Object>} - Progression result
   */
  async handlePlayerDeath(player, playerId) {
    if (this._xpLocks.has(playerId)) {
      logger.warn('XP grant skipped: concurrent request', { playerId });
      return null;
    }
    this._xpLocks.add(playerId);
    try {
      const gameStats = {
        kills: player.kills || 0,
        zombiesKilled: player.zombiesKilled || 0,
        wave: player.wave || 1,
        level: player.level || 1,
        survivalTimeSeconds: player.survivalTime || 0,
        bossKills: player.bossKills || 0,
        comboMax: player.maxCombo || 0,
        score: player.totalScore || 0,
        goldEarned: player.goldEarned || 0
      };

      const xpEarned = AddAccountXPUseCase.calculateXPFromGameStats(gameStats);
      const result = await this.addAccountXPUseCase.execute({ playerId, xpEarned, gameStats });

      // Invalidate cache so next spawn recalculates bonuses with new skills
      if (result && result.levelsGained > 0) {
        this._cache.invalidate(playerId);
      }

      logger.info('Player death processed', {
        playerId, xpEarned, levelsGained: result.levelsGained, newLevel: result.newLevel
      });
      return result;
    } catch (error) {
      logger.error('Failed to handle player death', { playerId, error: error.message });
      return null;
    } finally {
      this._xpLocks.delete(playerId);
    }
  }

  /**
   * Get player's active skill bonuses
   * @param {String} playerId - Player UUID
   * @returns {Promise<Object>} - Active skill effects
   */
  async getPlayerSkillBonuses(playerId) {
    const cached = this._cache.get(playerId);
    if (cached) {
return cached;
}

    try {
      const progression = await this.progressionRepository.findByPlayerId(playerId);

      if (!progression || progression.unlockedSkills.length === 0) {
        const defaults = this.getDefaultBonuses();
        this._cache.set(playerId, defaults);
        return defaults;
      }

      // Get all unlocked skills in a single batch query (avoids N+1)
      const skills = await this.progressionRepository.getSkillsByIds(progression.unlockedSkills);

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

      this._cache.set(playerId, bonuses);
      return bonuses;
    } catch (error) {
      logger.error('Failed to get player skill bonuses', { playerId, error: error.message });
      return this.getDefaultBonuses();
    }
  }

  /**
   * Invalidate cached bonuses for a player (call after skill unlock)
   * @param {string} playerId
   */
  invalidateBonusCache(playerId) {
    this._cache.invalidate(playerId);
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
