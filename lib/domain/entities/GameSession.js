/**
 * GAME SESSION ENTITY - Domain model
 * Represents an active or recoverable game session
 */

class GameSession {
  constructor({
    sessionId,
    playerId,
    socketId = null,
    state = null,
    createdAt = Date.now(),
    updatedAt = Date.now(),
    disconnectedAt = null
  }) {
    this.sessionId = sessionId;
    this.playerId = playerId;
    this.socketId = socketId;
    this.state = state;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.disconnectedAt = disconnectedAt;
  }

  /**
   * Mark session as disconnected
   */
  disconnect() {
    this.disconnectedAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Reconnect session with new socket
   */
  reconnect(socketId) {
    this.socketId = socketId;
    this.disconnectedAt = null;
    this.updatedAt = Date.now();
  }

  /**
   * Update session state
   */
  updateState(state) {
    this.state = state;
    this.updatedAt = Date.now();
  }

  /**
   * Check if session is active
   */
  isActive() {
    return this.disconnectedAt === null && this.socketId !== null;
  }

  /**
   * Check if session is recoverable (disconnected < timeout)
   */
  isRecoverable(timeoutMs = 300000) {
    if (!this.disconnectedAt) return false;
    return Date.now() - this.disconnectedAt < timeoutMs;
  }

  /**
   * Get time since disconnection in seconds
   */
  getDisconnectedDuration() {
    if (!this.disconnectedAt) return 0;
    return Math.floor((Date.now() - this.disconnectedAt) / 1000);
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      socketId: this.socketId,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      disconnectedAt: this.disconnectedAt
    };
  }

  /**
   * Create from database row
   */
  static fromDB(row) {
    return new GameSession({
      sessionId: row.session_id,
      playerId: row.player_id,
      socketId: row.socket_id,
      state: row.state ? JSON.parse(row.state) : null,
      createdAt: row.created_at * 1000,
      updatedAt: row.updated_at * 1000,
      disconnectedAt: row.disconnected_at ? row.disconnected_at * 1000 : null
    });
  }
}

module.exports = GameSession;
