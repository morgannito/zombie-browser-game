/**
 * RECOVER SESSION USE CASE
 * Recovers disconnected session if within timeout
 */

const logger = require('../../../infrastructure/logging/Logger');

class RecoverSessionUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
    this._recoveryLocks = new Set();
  }

  /**
   * Attempt to recover session
   * @param {Object} data - { sessionId, newSocketId, recoveryTimeoutMs }
   * @returns {Promise<GameSession|null>}
   */
  async execute({ sessionId, newSocketId, recoveryTimeoutMs = 300000 }) {
    if (this._recoveryLocks.has(sessionId)) {
      logger.debug('Recovery already in progress for session', { sessionId });
      return null;
    }

    this._recoveryLocks.add(sessionId);
    try {
      return await this._recover({ sessionId, newSocketId, recoveryTimeoutMs });
    } finally {
      this._recoveryLocks.delete(sessionId);
    }
  }

  async _recover({ sessionId, newSocketId, recoveryTimeoutMs }) {
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
