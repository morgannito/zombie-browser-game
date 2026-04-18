/**
 * SQLITE SESSION REPOSITORY
 * Infrastructure implementation of ISessionRepository
 */

const ISessionRepository = require('../../domain/repositories/ISessionRepository');
const GameSession = require('../../domain/entities/GameSession');
const { DatabaseError, ValidationError } = require('../../domain/errors/DomainErrors');
const logger = require('../../../infrastructure/logging/Logger');

class SQLiteSessionRepository extends ISessionRepository {
  constructor(db) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findById: this.db.prepare(`
        SELECT session_id, player_id, socket_id, state, created_at, updated_at, disconnected_at
        FROM sessions WHERE session_id = ?
      `),
      findByPlayerId: this.db.prepare(`
        SELECT session_id, player_id, socket_id, state, created_at, updated_at, disconnected_at
        FROM sessions WHERE player_id = ? AND disconnected_at IS NULL
      `),
      findBySocketId: this.db.prepare(`
        SELECT session_id, player_id, socket_id, state, created_at, updated_at, disconnected_at
        FROM sessions WHERE socket_id = ?
      `),
      create: this.db.prepare(`
        INSERT INTO sessions (session_id, player_id, socket_id, state)
        VALUES (?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE sessions
        SET socket_id = ?, state = ?, updated_at = strftime('%s', 'now'), disconnected_at = ?
        WHERE session_id = ?
      `),
      delete: this.db.prepare('DELETE FROM sessions WHERE session_id = ?'),
      findRecoverable: this.db.prepare(`
        SELECT session_id, player_id, socket_id, state, created_at, updated_at, disconnected_at
        FROM sessions
        WHERE disconnected_at IS NOT NULL
        AND (strftime('%s', 'now') - disconnected_at) < ?
      `),
      cleanupExpired: this.db.prepare(`
        DELETE FROM sessions
        WHERE disconnected_at IS NOT NULL
        AND (strftime('%s', 'now') - disconnected_at) > ?
      `)
    };
  }

  /**
   * Find a session by its ID.
   * @param {string} sessionId
   * @returns {Promise<GameSession|null>}
   */
  async findById(sessionId) {
    try {
      if (!sessionId) {
        throw new ValidationError('Session ID is required');
      }
      const row = this.stmts.findById.get(sessionId);
      return row ? GameSession.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findById', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to retrieve session', error);
    }
  }

  /**
   * Find active sessions for a player.
   * @param {string} playerId
   * @returns {Promise<GameSession[]>}
   */
  async findByPlayerId(playerId) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }
      const rows = this.stmts.findByPlayerId.all(playerId);
      return rows.map(row => GameSession.fromDB(row));
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findByPlayerId', {
        playerId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to retrieve sessions by player', error);
    }
  }

  /**
   * Find a session by socket ID.
   * @param {string} socketId
   * @returns {Promise<GameSession|null>}
   */
  async findBySocketId(socketId) {
    try {
      if (!socketId) {
        throw new ValidationError('Socket ID is required');
      }
      const row = this.stmts.findBySocketId.get(socketId);
      return row ? GameSession.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findBySocketId', {
        socketId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to retrieve session by socket', error);
    }
  }

  /**
   * Persist a new session.
   * @param {GameSession} session
   * @returns {Promise<GameSession>}
   */
  async create(session) {
    try {
      if (!session || !session.sessionId) {
        throw new ValidationError('Session with valid sessionId is required');
      }
      this.stmts.create.run(
        session.sessionId,
        session.playerId,
        session.socketId,
        session.state ? JSON.stringify(session.state) : null
      );
      return session;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in create', {
        sessionId: session.sessionId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to create session', error);
    }
  }

  /**
   * Update an existing session.
   * @param {GameSession} session
   * @returns {Promise<GameSession>}
   */
  async update(session) {
    try {
      if (!session || !session.sessionId) {
        throw new ValidationError('Session with valid sessionId is required for update');
      }
      this.stmts.update.run(
        session.socketId,
        session.state ? JSON.stringify(session.state) : null,
        session.disconnectedAt ? Math.floor(session.disconnectedAt / 1000) : null,
        session.sessionId
      );
      return session;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in update', {
        sessionId: session.sessionId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to update session', error);
    }
  }

  /**
   * Delete a session by ID.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async delete(sessionId) {
    try {
      if (!sessionId) {
        throw new ValidationError('Session ID is required');
      }
      this.stmts.delete.run(sessionId);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in delete', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to delete session', error);
    }
  }

  /**
   * Find sessions that disconnected within the recovery window.
   * @param {number} [timeoutMs=300000]
   * @returns {Promise<GameSession[]>}
   */
  async findRecoverable(timeoutMs = 300000) {
    try {
      const timeoutSecs = Math.floor(timeoutMs / 1000);
      const rows = this.stmts.findRecoverable.all(timeoutSecs);
      return rows.map(row => GameSession.fromDB(row));
    } catch (error) {
      logger.error('Database error in findRecoverable', {
        timeoutMs,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to retrieve recoverable sessions', error);
    }
  }

  /**
   * Delete sessions older than maxAgeMs.
   * @param {number} maxAgeMs
   * @returns {Promise<number>} rows deleted
   */
  async cleanupExpired(maxAgeMs) {
    try {
      const maxAgeSecs = Math.floor(maxAgeMs / 1000);
      const result = this.stmts.cleanupExpired.run(maxAgeSecs);
      return result.changes;
    } catch (error) {
      logger.error('Database error in cleanupExpired', {
        maxAgeMs,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to cleanup expired sessions', error);
    }
  }
}

module.exports = SQLiteSessionRepository;
