const { requirePresence, requireNonNegative } = require('../shared/Invariants');

/**
 * LEADERBOARD ENTRY ENTITY
 * Domain model for leaderboard scores
 */

/**
 * Represente une entree du classement pour un joueur apres une session.
 * Encapsule le score composite et les statistiques associees.
 * @class
 */
class LeaderboardEntry {
  /**
   * @param {Object} data - Donnees de l'entree
   * @param {number|null} [data.id=null] - Identifiant en base (null si non persiste)
   * @param {string} data.playerId - UUID du joueur
   * @param {string} data.playerUsername - Pseudo du joueur
   * @param {number} data.wave - Vague atteinte (>= 0)
   * @param {number} data.level - Niveau atteint (>= 0)
   * @param {number} data.kills - Nombre de kills (>= 0)
   * @param {number} data.survivalTime - Temps de survie en secondes (>= 0)
   * @param {number} data.score - Score composite (>= 0)
   * @param {number} [data.createdAt=Date.now()] - Timestamp de creation
   */
  constructor({
    id = null,
    playerId,
    playerUsername,
    wave,
    level,
    kills,
    survivalTime,
    score,
    createdAt = Date.now()
  }) {
    requirePresence(playerId, 'playerId');
    requirePresence(playerUsername, 'playerUsername');
    requireNonNegative(wave, 'wave');
    requireNonNegative(level, 'level');
    requireNonNegative(kills, 'kills');
    requireNonNegative(survivalTime, 'survivalTime');
    requireNonNegative(score, 'score');

    /** @type {number|null} */
    this.id = id;
    /** @type {string} */
    this.playerId = playerId;
    /** @type {string} */
    this.playerUsername = playerUsername;
    /** @type {number} */
    this.wave = wave;
    /** @type {number} */
    this.level = level;
    /** @type {number} */
    this.kills = kills;
    /** @type {number} */
    this.survivalTime = survivalTime;
    /** @type {number} */
    this.score = score;
    /** @type {number} */
    this.createdAt = createdAt;
  }

  /**
   * Calcule le score composite pour le classement.
   * Formule : wave*100 + level*50 + kills*10 + floor(survivalTime/60)*5
   * @param {number} wave - Vague atteinte
   * @param {number} level - Niveau atteint
   * @param {number} kills - Nombre de kills
   * @param {number} survivalTime - Temps de survie en secondes
   * @returns {number} Score composite
   */
  static calculateScore(wave, level, kills, survivalTime) {
    return (
      wave * 100 +
      level * 50 +
      kills * 10 +
      Math.floor(survivalTime / 60) * 5 // 5 points per minute survived
    );
  }

  /**
   * Formate le temps de survie en MM:SS.
   * @returns {string} Temps formate ex: "2:05"
   */
  getFormattedSurvivalTime() {
    const minutes = Math.floor(this.survivalTime / 60);
    const seconds = this.survivalTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Compare cette entree avec une autre pour le classement.
   * Priorite : score > wave > kills.
   * @param {LeaderboardEntry} other - Autre entree a comparer
   * @returns {boolean} true si cette entree est meilleure
   */
  isBetterThan(other) {
    if (this.score !== other.score) {
      return this.score > other.score;
    }
    if (this.wave !== other.wave) {
      return this.wave > other.wave;
    }
    return this.kills > other.kills;
  }

  /**
   * Convertit l'entree en objet simple pour la serialisation.
   * @returns {Object} Representation plain object de l'entree
   */
  toObject() {
    return {
      id: this.id,
      playerId: this.playerId,
      playerUsername: this.playerUsername,
      wave: this.wave,
      level: this.level,
      kills: this.kills,
      survivalTime: this.survivalTime,
      score: this.score,
      createdAt: this.createdAt
    };
  }

  /**
   * Cree une instance LeaderboardEntry a partir d'une ligne de base de donnees.
   * @param {Object} row - Ligne brute de la base de donnees
   * @param {string|null} [username=null] - Pseudo a utiliser (prioritaire sur row.username)
   * @returns {LeaderboardEntry} Nouvelle instance hydratee
   */
  static fromDB(row, username = null) {
    return new LeaderboardEntry({
      id: row.id,
      playerId: row.player_id,
      playerUsername: username || row.username,
      wave: row.wave,
      level: row.level,
      kills: row.kills,
      survivalTime: row.survival_time,
      score: row.score,
      createdAt: row.created_at * 1000
    });
  }
}

module.exports = LeaderboardEntry;
