/**
 * SESSION REPOSITORY INTERFACE
 * Defines contract for session persistence
 * Domain layer - no implementation details
 */

class ISessionRepository {
  /**
   * Find session by ID
   * @param {string} sessionId
   * @returns {Promise<GameSession|null>}
   */
  async findById(sessionId) {
    throw new Error('Method not implemented');
  }

  /**
   * Find active sessions for player
   * @param {string} playerId
   * @returns {Promise<GameSession[]>}
   */
  async findByPlayerId(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Find session by socket ID
   * @param {string} socketId
   * @returns {Promise<GameSession|null>}
   */
  async findBySocketId(socketId) {
    throw new Error('Method not implemented');
  }

  /**
   * Create new session
   * @param {GameSession} session
   * @returns {Promise<GameSession>}
   */
  async create(session) {
    throw new Error('Method not implemented');
  }

  /**
   * Update session
   * @param {GameSession} session
   * @returns {Promise<GameSession>}
   */
  async update(session) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete session
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async delete(sessionId) {
    throw new Error('Method not implemented');
  }

  /**
   * Find recoverable sessions (disconnected but within timeout)
   * @param {number} timeoutMs
   * @returns {Promise<GameSession[]>}
   */
  async findRecoverable(timeoutMs = 300000) {
    throw new Error('Method not implemented');
  }

  /**
   * Clean up expired sessions
   * @param {number} maxAgeMs
   * @returns {Promise<number>}
   */
  async cleanupExpired(maxAgeMs) {
    throw new Error('Method not implemented');
  }
}

module.exports = ISessionRepository;
