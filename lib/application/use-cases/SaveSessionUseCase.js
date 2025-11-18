/**
 * SAVE SESSION USE CASE
 * Saves or updates game session state
 */

const GameSession = require('../../domain/entities/GameSession');
const logger = require('../../infrastructure/Logger');

class SaveSessionUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  /**
   * Save or update session
   * @param {Object} data - { sessionId, playerId, socketId, state }
   * @returns {Promise<GameSession>}
   */
  async execute({ sessionId, playerId, socketId, state }) {
    // Check if session exists
    let session = await this.sessionRepository.findById(sessionId);

    if (session) {
      // Update existing session
      if (socketId) session.socketId = socketId;
      if (state) session.updateState(state);

      await this.sessionRepository.update(session);

      logger.debug('Session updated', { sessionId, playerId });
    } else {
      // Create new session
      session = new GameSession({
        sessionId,
        playerId,
        socketId,
        state
      });

      await this.sessionRepository.create(session);

      logger.info('Session created', { sessionId, playerId });
    }

    return session;
  }
}

module.exports = SaveSessionUseCase;
