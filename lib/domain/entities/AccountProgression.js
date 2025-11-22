/**
 * ACCOUNT PROGRESSION ENTITY - Domain model
 * Represents meta-progression system (account levels, prestige, skill points)
 * Pure business logic, no infrastructure dependencies
 * @version 1.0.0
 */

class AccountProgression {
  constructor({
    playerId,
    accountLevel = 1,
    accountXP = 0,
    totalXPEarned = 0,
    skillPoints = 0,
    prestigeLevel = 0,
    prestigeTokens = 0,
    unlockedSkills = [],
    createdAt = Date.now(),
    lastUpdated = Date.now()
  }) {
    this.playerId = playerId;
    this.accountLevel = accountLevel;
    this.accountXP = accountXP;
    this.totalXPEarned = totalXPEarned;
    this.skillPoints = skillPoints;
    this.prestigeLevel = prestigeLevel;
    this.prestigeTokens = prestigeTokens;
    this.unlockedSkills = unlockedSkills; // Array of skill IDs
    this.createdAt = createdAt;
    this.lastUpdated = lastUpdated;
  }

  /**
   * Calculate XP required for next account level
   * Formula: 1000 + (level * 500) - exponential scaling
   */
  getXPForNextLevel() {
    return Math.floor(1000 + (this.accountLevel * 500) + Math.pow(this.accountLevel, 1.5) * 100);
  }

  /**
   * Add XP and handle level ups
   * @param {Number} xp - XP to add
   * @returns {Object} - { levelsGained, skillPointsGained, newLevel }
   */
  addXP(xp) {
    this.accountXP += xp;
    this.totalXPEarned += xp;

    let levelsGained = 0;
    let skillPointsGained = 0;

    // Check for level ups (can level up multiple times)
    while (this.accountXP >= this.getXPForNextLevel()) {
      this.accountXP -= this.getXPForNextLevel();
      this.accountLevel++;
      levelsGained++;

      // Earn 1 skill point per level
      this.skillPoints++;
      skillPointsGained++;

      // Bonus skill point every 5 levels
      if (this.accountLevel % 5 === 0) {
        this.skillPoints++;
        skillPointsGained++;
      }
    }

    this.lastUpdated = Date.now();

    return {
      levelsGained,
      skillPointsGained,
      newLevel: this.accountLevel,
      currentXP: this.accountXP,
      xpForNext: this.getXPForNextLevel()
    };
  }

  /**
   * Unlock a skill with skill points
   * @param {String} skillId - Skill to unlock
   * @param {Number} cost - Skill point cost
   * @returns {Boolean} - Success
   */
  unlockSkill(skillId, cost = 1) {
    if (this.skillPoints < cost) {
      throw new Error('Not enough skill points');
    }

    if (this.unlockedSkills.includes(skillId)) {
      throw new Error('Skill already unlocked');
    }

    this.skillPoints -= cost;
    this.unlockedSkills.push(skillId);
    this.lastUpdated = Date.now();

    return true;
  }

  /**
   * Check if a skill is unlocked
   * @param {String} skillId - Skill ID
   * @returns {Boolean}
   */
  hasSkill(skillId) {
    return this.unlockedSkills.includes(skillId);
  }

  /**
   * Prestige - Reset progress for prestige tokens and bonuses
   * @param {Number} minLevel - Minimum level required to prestige
   * @returns {Object} - { success, tokensEarned }
   */
  prestige(minLevel = 50) {
    if (this.accountLevel < minLevel) {
      throw new Error(`Must be at least level ${minLevel} to prestige`);
    }

    // Calculate prestige tokens earned (1 per 10 levels above 50)
    const tokensEarned = Math.floor((this.accountLevel - minLevel) / 10) + 1;

    // Reset progress
    this.accountLevel = 1;
    this.accountXP = 0;
    this.skillPoints = 0;
    this.unlockedSkills = [];
    this.prestigeLevel++;
    this.prestigeTokens += tokensEarned;
    this.lastUpdated = Date.now();

    return {
      success: true,
      tokensEarned,
      newPrestigeLevel: this.prestigeLevel,
      totalTokens: this.prestigeTokens
    };
  }

  /**
   * Get prestige bonuses (passive benefits from prestige level)
   * @returns {Object} - { xpBonus, goldBonus, damageBonus, healthBonus }
   */
  getPrestigeBonuses() {
    return {
      xpBonus: this.prestigeLevel * 0.05, // +5% XP per prestige
      goldBonus: this.prestigeLevel * 0.05, // +5% gold per prestige
      damageBonus: this.prestigeLevel * 0.02, // +2% damage per prestige
      healthBonus: this.prestigeLevel * 10, // +10 HP per prestige
      startingGold: this.prestigeLevel * 50 // Extra starting gold
    };
  }

  /**
   * Calculate progress percentage to next level
   * @returns {Number} - Percentage (0-100)
   */
  getLevelProgress() {
    const xpForNext = this.getXPForNextLevel();
    return Math.floor((this.accountXP / xpForNext) * 100);
  }

  /**
   * Get comprehensive stats
   * @returns {Object}
   */
  getStats() {
    return {
      accountLevel: this.accountLevel,
      accountXP: this.accountXP,
      xpForNextLevel: this.getXPForNextLevel(),
      levelProgress: this.getLevelProgress(),
      totalXPEarned: this.totalXPEarned,
      skillPoints: this.skillPoints,
      unlockedSkillsCount: this.unlockedSkills.length,
      prestigeLevel: this.prestigeLevel,
      prestigeTokens: this.prestigeTokens,
      prestigeBonuses: this.getPrestigeBonuses()
    };
  }

  /**
   * Convert to plain object for serialization
   */
  toObject() {
    return {
      playerId: this.playerId,
      accountLevel: this.accountLevel,
      accountXP: this.accountXP,
      totalXPEarned: this.totalXPEarned,
      skillPoints: this.skillPoints,
      prestigeLevel: this.prestigeLevel,
      prestigeTokens: this.prestigeTokens,
      unlockedSkills: this.unlockedSkills,
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Create from database row
   */
  static fromDB(row) {
    return new AccountProgression({
      playerId: row.player_id,
      accountLevel: row.account_level,
      accountXP: row.account_xp,
      totalXPEarned: row.total_xp_earned,
      skillPoints: row.skill_points,
      prestigeLevel: row.prestige_level,
      prestigeTokens: row.prestige_tokens,
      unlockedSkills: row.unlocked_skills ? JSON.parse(row.unlocked_skills) : [],
      createdAt: row.created_at * 1000,
      lastUpdated: row.last_updated * 1000
    });
  }
}

module.exports = AccountProgression;
