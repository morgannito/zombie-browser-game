/**
 * SUBMIT SCORE USE CASE
 * Submits a score to the leaderboard
 */

const LeaderboardEntry = require("../../lib/domain/entities/LeaderboardEntry");
const logger = require("../../infrastructure/logging/Logger");
const { ValidationError, NotFoundError } = require("../../lib/domain/errors/DomainErrors");

/**
 * Use case de soumission d'un score au classement.
 * Valide les donnees, recupere le joueur, calcule le score et persiste l'entree.
 * @class
 */
class SubmitScoreUseCase {
  /**
   * @param {Object} leaderboardRepository - Repository d'acces au classement (port domaine)
   * @param {Object} playerRepository - Repository d'acces aux donnees joueur (port domaine)
   */
  constructor(leaderboardRepository, playerRepository) {
    /** @type {Object} */
    this.leaderboardRepository = leaderboardRepository;
    /** @type {Object} */
    this.playerRepository = playerRepository;
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
    // Validate input
    if (!playerId || wave < 0 || level < 0 || kills < 0 || survivalTime < 0) {
      throw new ValidationError('Invalid score data');
    }

    // Get player info
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new NotFoundError('Player', playerId);
    }

    // Calculate score
    const score = LeaderboardEntry.calculateScore(wave, level, kills, survivalTime);

    // Create entry
    const entry = new LeaderboardEntry({
      playerId,
      playerUsername: player.username,
      wave,
      level,
      kills,
      survivalTime,
      score
    });

    // Submit to leaderboard
    await this.leaderboardRepository.submit(entry);

    logger.info('Score submitted to leaderboard', {
      playerId,
      username: player.username,
      wave,
      level,
      score
    });

    return entry;
  }
}

module.exports = SubmitScoreUseCase;
