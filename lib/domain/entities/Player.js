/**
 * PLAYER ENTITY - Domain model
 * Pure business logic, no infrastructure dependencies
 */

/**
 * Represente un joueur avec ses statistiques cumulees et records personnels.
 * Entite du domaine contenant la logique metier pure liee au joueur.
 * @class
 */
class Player {
  /**
   * @param {Object} data - Donnees d'initialisation du joueur
   * @param {string} data.id - UUID unique du joueur
   * @param {string} data.username - Pseudo du joueur
   * @param {number} [data.totalKills=0] - Nombre total de kills cumules
   * @param {number} [data.totalDeaths=0] - Nombre total de morts cumulees
   * @param {number} [data.highestWave=0] - Vague la plus haute atteinte
   * @param {number} [data.highestLevel=0] - Niveau le plus haut atteint
   * @param {number} [data.totalPlaytime=0] - Temps de jeu total en millisecondes
   * @param {number} [data.totalGoldEarned=0] - Or total gagne
   * @param {number} [data.createdAt=Date.now()] - Timestamp de creation
   * @param {number} [data.lastSeen=Date.now()] - Timestamp de derniere connexion
   */
  constructor({
    id,
    username,
    totalKills = 0,
    totalDeaths = 0,
    highestWave = 0,
    highestLevel = 0,
    totalPlaytime = 0,
    totalGoldEarned = 0,
    createdAt = Date.now(),
    lastSeen = Date.now()
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.username = username;
    /** @type {number} */
    this.totalKills = totalKills;
    /** @type {number} */
    this.totalDeaths = totalDeaths;
    /** @type {number} */
    this.highestWave = highestWave;
    /** @type {number} */
    this.highestLevel = highestLevel;
    /** @type {number} */
    this.totalPlaytime = totalPlaytime;
    /** @type {number} */
    this.totalGoldEarned = totalGoldEarned;
    /** @type {number} */
    this.createdAt = createdAt;
    /** @type {number} */
    this.lastSeen = lastSeen;
  }

  /**
   * Met a jour les statistiques du joueur apres une session de jeu.
   * Les kills et deaths sont cumules, wave et level sont remplaces si superieurs.
   * @param {Object} stats - Statistiques de la session
   * @param {number} stats.kills - Nombre de kills durant la session
   * @param {number} stats.deaths - Nombre de morts durant la session
   * @param {number} stats.wave - Vague atteinte durant la session
   * @param {number} stats.level - Niveau atteint durant la session
   * @param {number} stats.playtime - Duree de la session en millisecondes
   * @param {number} stats.goldEarned - Or gagne durant la session
   * @returns {void}
   */
  updateStats({ kills, deaths, wave, level, playtime, goldEarned }) {
    this.totalKills += kills;
    this.totalDeaths += deaths;
    this.highestWave = Math.max(this.highestWave, wave);
    this.highestLevel = Math.max(this.highestLevel, level);
    this.totalPlaytime += playtime;
    this.totalGoldEarned += goldEarned;
    this.lastSeen = Date.now();
  }

  /**
   * Verifie si le joueur a atteint un nouveau record personnel.
   * @param {number} wave - Vague atteinte
   * @param {number} level - Niveau atteint
   * @returns {boolean} true si la wave ou le level depasse le record actuel
   */
  isNewRecord(wave, level) {
    return wave > this.highestWave || level > this.highestLevel;
  }

  /**
   * Calcule le score global du joueur base sur ses statistiques cumulees.
   * Formule : kills*10 + highestWave*100 + highestLevel*50 + totalGoldEarned.
   * @returns {number} Score global calcule
   */
  calculateScore() {
    return (
      this.totalKills * 10 + this.highestWave * 100 + this.highestLevel * 50 + this.totalGoldEarned
    );
  }

  /**
   * Calcule le ratio kills/deaths du joueur.
   * @returns {number} Ratio K/D arrondi à 2 décimales.
   */
  getKDRatio() {
    if (this.totalDeaths === 0) {
      return this.totalKills;
    }
    return Math.round((this.totalKills / this.totalDeaths) * 100) / 100;
  }

  /**
   * Convertit l'entite en objet simple pour la serialisation.
   * @returns {Object} Representation plain object du joueur
   */
  toObject() {
    return {
      id: this.id,
      username: this.username,
      totalKills: this.totalKills,
      totalDeaths: this.totalDeaths,
      highestWave: this.highestWave,
      highestLevel: this.highestLevel,
      totalPlaytime: this.totalPlaytime,
      totalGoldEarned: this.totalGoldEarned,
      createdAt: this.createdAt,
      lastSeen: this.lastSeen
    };
  }

  /**
   * Cree une instance Player a partir d'une ligne de base de donnees.
   * Convertit les noms snake_case en camelCase et les timestamps seconds en millisecondes.
   * @param {Object} row - Ligne brute de la base de donnees
   * @param {string} row.id - UUID du joueur
   * @param {string} row.username - Pseudo
   * @param {number} row.total_kills - Kills cumules
   * @param {number} row.total_deaths - Morts cumulees
   * @param {number} row.highest_wave - Record de vague
   * @param {number} row.highest_level - Record de niveau
   * @param {number} row.total_playtime - Temps de jeu total
   * @param {number} row.total_gold_earned - Or total
   * @param {number} row.created_at - Timestamp creation (secondes UNIX)
   * @param {number} row.last_seen - Timestamp derniere connexion (secondes UNIX)
   * @returns {Player} Nouvelle instance Player hydratee
   */
  static fromDB(row) {
    return new Player({
      id: row.id,
      username: row.username,
      totalKills: row.total_kills,
      totalDeaths: row.total_deaths,
      highestWave: row.highest_wave,
      highestLevel: row.highest_level,
      totalPlaytime: row.total_playtime,
      totalGoldEarned: row.total_gold_earned,
      createdAt: row.created_at * 1000, // SQLite uses seconds
      lastSeen: row.last_seen * 1000
    });
  }
}

module.exports = Player;
