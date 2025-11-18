/**
 * SQLITE SESSION REPOSITORY
 * Infrastructure implementation of ISessionRepository
 */

const ISessionRepository = require('../../domain/repositories/ISessionRepository');
const GameSession = require('../../domain/entities/GameSession');

class SQLiteSessionRepository extends ISessionRepository {
  constructor(db) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findById: this.db.prepare('SELECT * FROM sessions WHERE session_id = ?'),
      findByPlayerId: this.db.prepare('SELECT * FROM sessions WHERE player_id = ? AND disconnected_at IS NULL'),
      findBySocketId: this.db.prepare('SELECT * FROM sessions WHERE socket_id = ?'),
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
        SELECT * FROM sessions
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

  async findById(sessionId) {
    const row = this.stmts.findById.get(sessionId);
    return row ? GameSession.fromDB(row) : null;
  }

  async findByPlayerId(playerId) {
    const rows = this.stmts.findByPlayerId.all(playerId);
    return rows.map(row => GameSession.fromDB(row));
  }

  async findBySocketId(socketId) {
    const row = this.stmts.findBySocketId.get(socketId);
    return row ? GameSession.fromDB(row) : null;
  }

  async create(session) {
    this.stmts.create.run(
      session.sessionId,
      session.playerId,
      session.socketId,
      session.state ? JSON.stringify(session.state) : null
    );
    return session;
  }

  async update(session) {
    this.stmts.update.run(
      session.socketId,
      session.state ? JSON.stringify(session.state) : null,
      session.disconnectedAt ? Math.floor(session.disconnectedAt / 1000) : null,
      session.sessionId
    );
    return session;
  }

  async delete(sessionId) {
    this.stmts.delete.run(sessionId);
  }

  async findRecoverable(timeoutMs = 300000) {
    const timeoutSecs = Math.floor(timeoutMs / 1000);
    const rows = this.stmts.findRecoverable.all(timeoutSecs);
    return rows.map(row => GameSession.fromDB(row));
  }

  async cleanupExpired(maxAgeMs) {
    const maxAgeSecs = Math.floor(maxAgeMs / 1000);
    const result = this.stmts.cleanupExpired.run(maxAgeSecs);
    return result.changes;
  }
}

module.exports = SQLiteSessionRepository;
