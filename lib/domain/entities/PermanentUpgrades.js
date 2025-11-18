/**
 * PERMANENT UPGRADES ENTITY
 * Domain model for player permanent upgrades
 */

class PermanentUpgrades {
  constructor({
    playerId,
    maxHealthLevel = 0,
    damageLevel = 0,
    speedLevel = 0,
    fireRateLevel = 0,
    updatedAt = Date.now()
  }) {
    this.playerId = playerId;
    this.maxHealthLevel = maxHealthLevel;
    this.damageLevel = damageLevel;
    this.speedLevel = speedLevel;
    this.fireRateLevel = fireRateLevel;
    this.updatedAt = updatedAt;
  }

  /**
   * Upgrade a specific stat
   */
  upgrade(statName) {
    const levelMap = {
      maxHealth: 'maxHealthLevel',
      damage: 'damageLevel',
      speed: 'speedLevel',
      fireRate: 'fireRateLevel'
    };

    const levelProp = levelMap[statName];
    if (!levelProp) {
      throw new Error(`Invalid stat name: ${statName}`);
    }

    this[levelProp]++;
    this.updatedAt = Date.now();
  }

  /**
   * Get current level for a stat
   */
  getLevel(statName) {
    const levelMap = {
      maxHealth: this.maxHealthLevel,
      damage: this.damageLevel,
      speed: this.speedLevel,
      fireRate: this.fireRateLevel
    };

    return levelMap[statName] || 0;
  }

  /**
   * Check if stat is at max level
   */
  isMaxLevel(statName, maxLevel = 10) {
    return this.getLevel(statName) >= maxLevel;
  }

  /**
   * Calculate total upgrade points spent
   */
  getTotalUpgrades() {
    return (
      this.maxHealthLevel +
      this.damageLevel +
      this.speedLevel +
      this.fireRateLevel
    );
  }

  /**
   * Get all upgrade levels as object
   */
  getAllLevels() {
    return {
      maxHealth: this.maxHealthLevel,
      damage: this.damageLevel,
      speed: this.speedLevel,
      fireRate: this.fireRateLevel
    };
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      playerId: this.playerId,
      maxHealthLevel: this.maxHealthLevel,
      damageLevel: this.damageLevel,
      speedLevel: this.speedLevel,
      fireRateLevel: this.fireRateLevel,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from database row
   */
  static fromDB(row) {
    return new PermanentUpgrades({
      playerId: row.player_id,
      maxHealthLevel: row.max_health_level,
      damageLevel: row.damage_level,
      speedLevel: row.speed_level,
      fireRateLevel: row.fire_rate_level,
      updatedAt: row.updated_at * 1000
    });
  }
}

module.exports = PermanentUpgrades;
