/**
 * DISCONNECT SESSION USE CASE
 * Marks session as disconnected for potential recovery
 */

const logger = require('../../infrastructure/Logger');

class DisconnectSessionUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  /**
   * Mark session as disconnected
   * @param {Object} data - { sessionId, saveState }
   * @returns {Promise<GameSession|null>}
   */
  async execute({ sessionId, saveState = true }) {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      logger.debug('Session not found for disconnect', { sessionId });
      return null;
    }

    if (!saveState) {
      // Delete session immediately
      await this.sessionRepository.delete(sessionId);
      logger.info('Session deleted on disconnect', { sessionId });
      return null;
    }

    // Mark as disconnected for recovery
    session.disconnect();
    await this.sessionRepository.update(session);

    logger.info('Session marked disconnected', {
      sessionId,
      playerId: session.playerId,
      recoverable: true
    });

    return session;
  }

  /**
   * Clean up expired sessions (called periodically)
   * @param {number} maxAgeMs
   * @returns {Promise<number>}
   */
  async cleanupExpired(maxAgeMs = 600000) {
    const deleted = await this.sessionRepository.cleanupExpired(maxAgeMs);

    if (deleted > 0) {
      logger.info('Expired sessions cleaned up', { count: deleted });
    }

    return deleted;
  }
}

module.exports = DisconnectSessionUseCase;
