/**
 * ACHIEVEMENT ENTITY - Domain model
 * Represents an achievement definition
 * @version 1.0.0
 */

class Achievement {
  constructor({
    id,
    category,
    name,
    description,
    iconUrl,
    points = 10,
    tier = 'bronze',
    requirementJson,
    hidden = false,
    sortOrder = 0
  }) {
    this.id = id;
    this.category = category; // 'combat', 'survival', 'collection', 'social'
    this.name = name;
    this.description = description;
    this.iconUrl = iconUrl;
    this.points = points;
    this.tier = tier; // 'bronze', 'silver', 'gold', 'platinum'
    this.requirements = typeof requirementJson === 'string' ? JSON.parse(requirementJson) : requirementJson;
    this.hidden = hidden;
    this.sortOrder = sortOrder;
  }

  /**
   * Check if requirements are met
   * @param {Object} stats - Player stats
   * @returns {Boolean}
   */
  checkRequirements(stats) {
    const req = this.requirements;

    if (req.totalKills && stats.totalKills < req.totalKills) {
      return false;
    }
    if (req.zombiesKilled && stats.zombiesKilled < req.zombiesKilled) {
      return false;
    }
    if (req.bossKills && stats.bossKills < req.bossKills) {
      return false;
    }
    if (req.highestWave && stats.highestWave < req.highestWave) {
      return false;
    }
    if (req.highestLevel && stats.highestLevel < req.highestLevel) {
      return false;
    }
    if (req.totalPlaytimeSeconds && stats.totalPlaytimeSeconds < req.totalPlaytimeSeconds) {
      return false;
    }
    if (req.longestSurvivalSeconds && stats.longestSurvivalSeconds < req.longestSurvivalSeconds) {
      return false;
    }
    if (req.highestCombo && stats.highestCombo < req.highestCombo) {
      return false;
    }
    if (req.gamesPlayed && stats.gamesPlayed < req.gamesPlayed) {
      return false;
    }
    if (req.gamesWon && stats.gamesWon < req.gamesWon) {
      return false;
    }

    return true;
  }

  toObject() {
    return {
      id: this.id,
      category: this.category,
      name: this.name,
      description: this.description,
      iconUrl: this.iconUrl,
      points: this.points,
      tier: this.tier,
      requirements: this.requirements,
      hidden: this.hidden,
      sortOrder: this.sortOrder
    };
  }
}

module.exports = Achievement;
