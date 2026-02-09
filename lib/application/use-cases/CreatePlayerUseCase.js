/**
 * CREATE PLAYER USE CASE
 * Application layer - orchestrates domain logic
 */

const Player = require('../../domain/entities/Player');
const logger = require('../../infrastructure/Logger');

/**
 * Use case de creation d'un nouveau joueur.
 * Valide les donnees, verifie l'unicite du pseudo et persiste l'entite Player.
 * @class
 */
class CreatePlayerUseCase {
  /**
   * @param {Object} playerRepository - Repository d'acces aux donnees joueur (port domaine)
   */
  constructor(playerRepository) {
    /** @type {Object} */
    this.playerRepository = playerRepository;
  }

  /**
   * Execute la creation d'un nouveau joueur.
   * Valide l'ID et le username, verifie que le pseudo n'est pas deja pris,
   * cree l'entite Player et la persiste via le repository.
   * @param {Object} data - Donnees du joueur a creer
   * @param {string} data.id - UUID unique du joueur
   * @param {string} data.username - Pseudo du joueur (2-20 caracteres)
   * @returns {Promise<Player>} Entite Player creee et persistee
   * @throws {Error} Si l'ID ou le username est manquant
   * @throws {Error} Si le username n'est pas entre 2 et 20 caracteres
   * @throws {Error} Si le username est deja utilise
   */
  async execute({ id, username }) {
    // Validation
    if (!id || !username) {
      throw new Error('ID and username are required');
    }

    if (username.length < 2 || username.length > 20) {
      throw new Error('Username must be between 2 and 20 characters');
    }

    // Check if username already exists
    const existing = await this.playerRepository.findByUsername(username);
    if (existing) {
      throw new Error('Username already taken');
    }

    // Create player entity
    const player = new Player({ id, username });

    // Persist
    await this.playerRepository.create(player);

    logger.info('Player created', { id, username });

    return player;
  }
}

module.exports = CreatePlayerUseCase;
