/**
 * CREATE PLAYER USE CASE
 * Application layer - orchestrates domain logic
 */

const Player = require('../../domain/entities/Player');
const logger = require('../../infrastructure/Logger');

class CreatePlayerUseCase {
  constructor(playerRepository) {
    this.playerRepository = playerRepository;
  }

  /**
   * Create a new player account
   * @param {Object} data - { id, username }
   * @returns {Promise<Player>}
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
