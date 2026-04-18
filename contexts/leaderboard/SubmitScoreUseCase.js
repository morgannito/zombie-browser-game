/**
 * SUBMIT SCORE USE CASE
 * Submits a score to the leaderboard
 */

const LeaderboardEntry = require('../../lib/domain/entities/LeaderboardEntry');
const logger = require('../../infrastructure/logging/Logger');
const { ValidationError, NotFoundError } = require('../../lib/domain/errors/DomainErrors');

/**
 * Use case de soumission d'un score au classement.
 * Valide les donnees, recupere le joueur, calcule le score et persiste l'entree.
 * @class
 */
const THROTTLE_MS = 60 * 1000; // 1 submit/min per player

class SubmitScoreUseCase {
  constructor(leaderboardRepository, playerRepository, cache = null) {
    this.leaderboardRepository = leaderboardRepository;
    this.playerRepository = playerRepository;
    this.cache = cache;
    this._throttle = new Map(); // playerId -> lastSubmitMs
  }

  _checkThrottle(playerId) {
    const last = this._throttle.get(playerId) || 0;
    if (Date.now() - last < THROTTLE_MS) {
throw new Error('Rate limit: 1 submit per minute');
}
    this._throttle.set(playerId, Date.now());
  }

  /**
   * Execute la soumission d'un score au classement.
   * Valide les donnees d'entree, recupere le joueur associe, calcule le score
   * composite et cree une entree LeaderboardEntry persistee via le repository.
   * @param {Object} data - Donnees du score a soumettre
   * @param {string} data.playerId - UUID du joueur
   * @param {number} data.wave - Vague atteinte (>= 0)
   * @param {number} data.level - Niveau atteint (>= 0)
   * @param {number} data.kills - Nombre de kills (>= 0)
   * @param {number} data.survivalTime - Temps de survie en secondes (>= 0)
   * @returns {Promise<LeaderboardEntry>} Entree de classement creee et persistee
   * @throws {Error} Si les donnees sont invalides (valeurs negatives ou playerId manquant)
   * @throws {Error} Si le joueur n'existe pas
   */
  async execute({ playerId, wave, level, kills, survivalTime }) {
    if (!playerId || wave < 0 || level < 0 || kills < 0 || survivalTime < 0) {
      throw new ValidationError('Invalid score data');
    }

    this._checkThrottle(playerId);

    const player = await this.playerRepository.findById(playerId);
    if (!player) {
throw new NotFoundError('Player', playerId);
}

    const score = LeaderboardEntry.calculateScore(wave, level, kills, survivalTime);
    const entry = new LeaderboardEntry({ playerId, playerUsername: player.username, wave, level, kills, survivalTime, score });

    await this.leaderboardRepository.submit(entry);

    if (this.cache?.isActive() && this.cache.shouldInvalidate(score)) {
      this.cache.invalidate();
    }

    logger.info('Score submitted to leaderboard', { playerId, username: player.username, wave, level, score });
    return entry;
  }
}

module.exports = SubmitScoreUseCase;
