/**
 * ACCOUNT PROGRESSION ENTITY - Domain model
 * Represents meta-progression system (account levels, prestige, skill points)
 * Pure business logic, no infrastructure dependencies
 * @version 1.0.0
 */

/**
 * Represente la progression du compte d'un joueur : niveaux, XP, prestige et competences.
 * Contient la logique metier pure de montee en niveau, prestige et deblocage de skills.
 * @class
 */
class AccountProgression {
  /**
   * @param {Object} data - Donnees d'initialisation de la progression
   * @param {string} data.playerId - UUID du joueur associe
   * @param {number} [data.accountLevel=1] - Niveau du compte
   * @param {number} [data.accountXP=0] - XP actuelle dans le niveau en cours
   * @param {number} [data.totalXPEarned=0] - XP totale gagnee depuis la creation
   * @param {number} [data.skillPoints=0] - Points de competence disponibles
   * @param {number} [data.prestigeLevel=0] - Niveau de prestige actuel
   * @param {number} [data.prestigeTokens=0] - Tokens de prestige accumules
   * @param {string[]} [data.unlockedSkills=[]] - Liste des IDs de competences debloquees
   * @param {number} [data.createdAt=Date.now()] - Timestamp de creation
   * @param {number} [data.lastUpdated=Date.now()] - Timestamp de derniere mise a jour
   */
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
    if (!playerId) {
throw new Error('playerId is required');
}
    if (accountLevel < 1) {
throw new Error('accountLevel must be >= 1');
}
    if (accountXP < 0) {
throw new Error('accountXP must be >= 0');
}
    if (totalXPEarned < 0) {
throw new Error('totalXPEarned must be >= 0');
}
    if (skillPoints < 0) {
throw new Error('skillPoints must be >= 0');
}
    if (prestigeLevel < 0) {
throw new Error('prestigeLevel must be >= 0');
}
    if (prestigeTokens < 0) {
throw new Error('prestigeTokens must be >= 0');
}
    /** @type {string} */
    this.playerId = playerId;
    /** @type {number} */
    this.accountLevel = accountLevel;
    /** @type {number} */
    this.accountXP = accountXP;
    /** @type {number} */
    this.totalXPEarned = totalXPEarned;
    /** @type {number} */
    this.skillPoints = skillPoints;
    /** @type {number} */
    this.prestigeLevel = prestigeLevel;
    /** @type {number} */
    this.prestigeTokens = prestigeTokens;
    /** @type {string[]} */
    this.unlockedSkills = unlockedSkills;
    /** @type {number} */
    this.createdAt = createdAt;
    /** @type {number} */
    this.lastUpdated = lastUpdated;
  }

  /**
   * Calcule l'XP requise pour passer au niveau suivant.
   * Formule : 1000 + (level * 500) + (level^1.5 * 100) - scaling exponentiel.
   * @returns {number} XP necessaire pour le prochain niveau
   */
  getXPForNextLevel() {
    return Math.floor(1000 + this.accountLevel * 500 + Math.pow(this.accountLevel, 1.5) * 100);
  }

  /**
   * Ajoute de l'XP et gere les montees de niveau successives.
   * Attribue 1 point de competence par niveau, +1 bonus tous les 5 niveaux.
   * @param {number} xp - Quantite d'XP a ajouter
   * @returns {Object} Resultat de l'ajout d'XP
   * @returns {number} returns.levelsGained - Nombre de niveaux gagnes
   * @returns {number} returns.skillPointsGained - Points de competence obtenus
   * @returns {number} returns.newLevel - Nouveau niveau du compte
   * @returns {number} returns.currentXP - XP restante dans le niveau actuel
   * @returns {number} returns.xpForNext - XP requise pour le prochain niveau
   */
  addXP(xp) {
    if (typeof xp !== 'number' || xp < 0) {
throw new Error('xp must be a non-negative number');
}
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
   * Debloque une competence en depensant des points de competence.
   * @param {string} skillId - Identifiant de la competence a debloquer
   * @param {number} [cost=1] - Cout en points de competence
   * @returns {boolean} true si le deblocage a reussi
   * @throws {Error} Si points insuffisants ou competence deja debloquee
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
   * Verifie si une competence est debloquee.
   * @param {string} skillId - Identifiant de la competence
   * @returns {boolean} true si la competence est debloquee
   */
  hasSkill(skillId) {
    return this.unlockedSkills.includes(skillId);
  }

  /**
   * Execute un prestige : reinitialise la progression en echange de tokens et bonus.
   * Necessite un niveau minimum. Attribue 1 token par tranche de 10 niveaux au-dessus du minimum.
   * @param {number} [minLevel=50] - Niveau minimum requis pour effectuer le prestige
   * @returns {Object} Resultat du prestige
   * @returns {boolean} returns.success - Toujours true si le prestige reussit
   * @returns {number} returns.tokensEarned - Nombre de tokens de prestige gagnes
   * @returns {number} returns.newPrestigeLevel - Nouveau niveau de prestige
   * @returns {number} returns.totalTokens - Total de tokens de prestige accumules
   * @throws {Error} Si le niveau du compte est inferieur au minimum requis
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
   * Retourne les bonus passifs accordes par le niveau de prestige.
   * @returns {Object} Bonus de prestige
   * @returns {number} returns.xpBonus - Bonus XP en pourcentage (+5% par prestige)
   * @returns {number} returns.goldBonus - Bonus or en pourcentage (+5% par prestige)
   * @returns {number} returns.damageBonus - Bonus degats en pourcentage (+2% par prestige)
   * @returns {number} returns.healthBonus - Bonus points de vie (+10 HP par prestige)
   * @returns {number} returns.startingGold - Or de depart supplementaire (+50 par prestige)
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
   * Calcule le pourcentage de progression vers le prochain niveau.
   * @returns {number} Pourcentage de progression (0-100)
   */
  getLevelProgress() {
    const xpForNext = this.getXPForNextLevel();
    return Math.floor((this.accountXP / xpForNext) * 100);
  }

  /**
   * Retourne un resume complet des statistiques de progression du compte.
   * @returns {Object} Statistiques completes incluant niveau, XP, prestige et bonus
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
   * Convertit l'entite en objet simple pour la serialisation.
   * @returns {Object} Representation plain object de la progression
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
   * Cree une instance AccountProgression a partir d'une ligne de base de donnees.
   * Convertit les noms snake_case en camelCase et parse le JSON des skills.
   * @param {Object} row - Ligne brute de la base de donnees
   * @param {string} row.player_id - UUID du joueur
   * @param {number} row.account_level - Niveau du compte
   * @param {number} row.account_xp - XP actuelle
   * @param {number} row.total_xp_earned - XP totale gagnee
   * @param {number} row.skill_points - Points de competence
   * @param {number} row.prestige_level - Niveau de prestige
   * @param {number} row.prestige_tokens - Tokens de prestige
   * @param {string|null} row.unlocked_skills - JSON des skills debloquees
   * @param {number} row.created_at - Timestamp creation (secondes UNIX)
   * @param {number} row.last_updated - Timestamp mise a jour (secondes UNIX)
   * @returns {AccountProgression} Nouvelle instance AccountProgression hydratee
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
