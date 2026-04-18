/**
 * ACHIEVEMENT ENTITY - Domain model
 * Represents an achievement definition
 * @version 1.0.0
 */

const VALID_CATEGORIES = ['combat', 'survival', 'collection', 'social'];
const VALID_TIERS = ['bronze', 'silver', 'gold', 'platinum'];

/**
 * Represente la definition d'un achievement (trophee) deblocable par le joueur.
 * Contient les criteres de deblocage et les metadonnees d'affichage.
 * @class
 */
class Achievement {
  /**
   * @param {Object} data - Donnees d'initialisation de l'achievement
   * @param {string} data.id - Identifiant unique de l'achievement
   * @param {string} data.category - Categorie : 'combat', 'survival', 'collection', 'social'
   * @param {string} data.name - Nom affiche
   * @param {string} data.description - Description affichee
   * @param {string} data.iconUrl - URL de l'icone
   * @param {number} [data.points=10] - Points attribues lors du deblocage
   * @param {string} [data.tier='bronze'] - Tier : 'bronze', 'silver', 'gold', 'platinum'
   * @param {Object|string} data.requirementJson - Criteres de deblocage (objet ou JSON)
   * @param {boolean} [data.hidden=false] - Si true, l'achievement est cache jusqu'au deblocage
   * @param {number} [data.sortOrder=0] - Ordre d'affichage
   */
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
    if (!id) throw new Error('Achievement id is required');
    if (!name) throw new Error('Achievement name is required');
    // description can be null (optional in DB schema)
    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(`Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (!VALID_TIERS.includes(tier)) {
      throw new Error(`Invalid tier: ${tier}. Must be one of: ${VALID_TIERS.join(', ')}`);
    }
    if (requirementJson == null) throw new Error('requirementJson is required');

    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.category = category;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.description = description;
    /** @type {string} */
    this.iconUrl = iconUrl;
    /** @type {number} */
    this.points = points;
    /** @type {string} */
    this.tier = tier;
    /** @type {Object} */
    this.requirements = typeof requirementJson === 'string' ? JSON.parse(requirementJson) : requirementJson;
    /** @type {boolean} */
    this.hidden = hidden;
    /** @type {number} */
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

  /**
   * Convertit l'entite en objet simple pour la serialisation.
   * @returns {Object} Representation plain object de l'achievement
   */
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
