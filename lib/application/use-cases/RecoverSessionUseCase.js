/**
 * RECOVER SESSION USE CASE
 * Recovers disconnected session if within timeout
 */

const logger = require('../../infrastructure/Logger');

class RecoverSessionUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  /**
   * Attempt to recover session
   * @param {Object} data - { sessionId, newSocketId, recoveryTimeoutMs }
   * @returns {Promise<GameSession|null>}
   */
  async execute({ sessionId, newSocketId, recoveryTimeoutMs = 300000 }) {
    // Find session
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      logger.debug('Session not found for recovery', { sessionId });
      return null;
    }

    // Check if recoverable
    if (!session.isRecoverable(recoveryTimeoutMs)) {
      logger.debug('Session expired, cannot recover', {
        sessionId,
        disconnectedSecs: session.getDisconnectedDuration()
      });

      // Clean up expired session
      await this.sessionRepository.delete(sessionId);
      return null;
    }

    // Reconnect session
    session.reconnect(newSocketId);
    await this.sessionRepository.update(session);

    logger.info('Session recovered', {
      sessionId,
      playerId: session.playerId,
      disconnectedSecs: session.getDisconnectedDuration()
    });

    return session;
  }
}

module.exports = RecoverSessionUseCase;
