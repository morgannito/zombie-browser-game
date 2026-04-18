/**
 * PERMANENT UPGRADES ENTITY
 * Domain model for player permanent upgrades
 */

/** @constant {number} Niveau maximum pour chaque amelioration permanente */
const MAX_UPGRADE_LEVEL = 10;

/** @constant {Object} Mapping nom de stat vers propriete d'instance */
const STAT_LEVEL_MAP = {
  maxHealth: 'maxHealthLevel',
  damage: 'damageLevel',
  speed: 'speedLevel',
  fireRate: 'fireRateLevel'
};

/**
 * Represente les ameliorations permanentes d'un joueur (inter-sessions).
 * Chaque stat peut etre amelioree jusqu'a MAX_UPGRADE_LEVEL (10).
 * @class
 */
class PermanentUpgrades {
  /**
   * @param {Object} data - Donnees d'initialisation
   * @param {string} data.playerId - UUID du joueur associe
   * @param {number} [data.maxHealthLevel=0] - Niveau d'amelioration de la sante max
   * @param {number} [data.damageLevel=0] - Niveau d'amelioration des degats
   * @param {number} [data.speedLevel=0] - Niveau d'amelioration de la vitesse
   * @param {number} [data.fireRateLevel=0] - Niveau d'amelioration de la cadence de tir
   * @param {number} [data.updatedAt=Date.now()] - Timestamp de derniere mise a jour
   */
  constructor({
    playerId,
    maxHealthLevel = 0,
    damageLevel = 0,
    speedLevel = 0,
    fireRateLevel = 0,
    updatedAt = Date.now()
  }) {
    if (!playerId) throw new Error('playerId is required');
    if (maxHealthLevel < 0 || maxHealthLevel > MAX_UPGRADE_LEVEL) {
      throw new Error(`maxHealthLevel must be between 0 and ${MAX_UPGRADE_LEVEL}`);
    }
    if (damageLevel < 0 || damageLevel > MAX_UPGRADE_LEVEL) {
      throw new Error(`damageLevel must be between 0 and ${MAX_UPGRADE_LEVEL}`);
    }
    if (speedLevel < 0 || speedLevel > MAX_UPGRADE_LEVEL) {
      throw new Error(`speedLevel must be between 0 and ${MAX_UPGRADE_LEVEL}`);
    }
    if (fireRateLevel < 0 || fireRateLevel > MAX_UPGRADE_LEVEL) {
      throw new Error(`fireRateLevel must be between 0 and ${MAX_UPGRADE_LEVEL}`);
    }

    /** @type {string} */
    this.playerId = playerId;
    /** @type {number} */
    this.maxHealthLevel = maxHealthLevel;
    /** @type {number} */
    this.damageLevel = damageLevel;
    /** @type {number} */
    this.speedLevel = speedLevel;
    /** @type {number} */
    this.fireRateLevel = fireRateLevel;
    /** @type {number} */
    this.updatedAt = updatedAt;
  }

  /**
   * Ameliore une stat d'un niveau.
   * @param {string} statName - Nom de la stat : 'maxHealth', 'damage', 'speed', 'fireRate'
   * @param {number} [maxLevel=MAX_UPGRADE_LEVEL] - Niveau maximum autorise
   * @returns {void}
   * @throws {Error} Si le nom de stat est invalide ou si le niveau max est atteint
   */
  upgrade(statName, maxLevel = MAX_UPGRADE_LEVEL) {
    const levelProp = STAT_LEVEL_MAP[statName];
    if (!levelProp) {
      throw new Error(`Invalid stat name: ${statName}`);
    }

    if (this[levelProp] >= maxLevel) {
      throw new Error(`${statName} is already at max level (${maxLevel})`);
    }

    this[levelProp]++;
    this.updatedAt = Date.now();
  }

  /**
   * Retourne le niveau actuel d'une stat.
   * @param {string} statName - Nom de la stat
   * @returns {number} Niveau actuel (0 si stat inconnue)
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
   * Verifie si une stat est au niveau maximum.
   * @param {string} statName - Nom de la stat
   * @param {number} [maxLevel=MAX_UPGRADE_LEVEL] - Niveau maximum a verifier
   * @returns {boolean} true si le niveau max est atteint
   */
  isMaxLevel(statName, maxLevel = MAX_UPGRADE_LEVEL) {
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
