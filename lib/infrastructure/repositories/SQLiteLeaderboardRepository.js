/**
 * SQLITE LEADERBOARD REPOSITORY
 * Infrastructure implementation
 */

const ILeaderboardRepository = require('../../domain/repositories/ILeaderboardRepository');
const LeaderboardEntry = require('../../domain/entities/LeaderboardEntry');
const { DatabaseError, ValidationError, NotFoundError } = require('../../domain/errors/DomainErrors');
const logger = require('../Logger');

class SQLiteLeaderboardRepository extends ILeaderboardRepository {
  constructor(db) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      submit: this.db.prepare(`
        INSERT INTO leaderboard (player_id, wave, level, kills, survival_time, score)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      getTop: this.db.prepare(`
        SELECT l.*, p.username
        FROM leaderboard l
        JOIN players p ON l.player_id = p.id
        ORDER BY l.score DESC, l.wave DESC, l.kills DESC
        LIMIT ?
      `),
      getByPlayer: this.db.prepare(`
        SELECT l.*, p.username
        FROM leaderboard l
        JOIN players p ON l.player_id = p.id
        WHERE l.player_id = ?
        ORDER BY l.score DESC
        LIMIT ?
      `),
      getBestForPlayer: this.db.prepare(`
        SELECT l.*, p.username
        FROM leaderboard l
        JOIN players p ON l.player_id = p.id
        WHERE l.player_id = ?
        ORDER BY l.score DESC
        LIMIT 1
      `),
      getPlayerRank: this.db.prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM leaderboard l1
        JOIN (
          SELECT player_id, MAX(score) as best_score
          FROM leaderboard
          WHERE player_id = ?
        ) l2
        WHERE l1.score > l2.best_score
      `),
      cleanup: this.db.prepare(`
        DELETE FROM leaderboard
        WHERE id NOT IN (
          SELECT id FROM leaderboard
          ORDER BY score DESC
          LIMIT ?
        )
      `)
    };
  }

  async submit(entry) {
    try {
      if (!entry || !entry.playerId) {
        throw new ValidationError('Leaderboard entry with valid playerId is required');
      }
      if (typeof entry.wave !== 'number' || entry.wave < 0) {
        throw new ValidationError('Wave must be a non-negative number');
      }
      if (typeof entry.score !== 'number' || entry.score < 0) {
        throw new ValidationError('Score must be a non-negative number');
      }

      const result = this.stmts.submit.run(
        entry.playerId,
        entry.wave,
        entry.level,
        entry.kills,
        entry.survivalTime,
        entry.score
      );

      entry.id = result.lastInsertRowid;
      return entry;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in submit', { playerId: entry?.playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to submit leaderboard entry', error);
    }
  }

  async getTop(limit = 10) {
    try {
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }
      const rows = this.stmts.getTop.all(limit);
      return rows.map(row => LeaderboardEntry.fromDB(row));
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in getTop', { limit, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve top leaderboard entries', error);
    }
  }

  async getByPlayer(playerId, limit = 10) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }
      const rows = this.stmts.getByPlayer.all(playerId, limit);
      return rows.map(row => LeaderboardEntry.fromDB(row));
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in getByPlayer', { playerId, limit, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve player leaderboard entries', error);
    }
  }

  async getBestForPlayer(playerId) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }
      const row = this.stmts.getBestForPlayer.get(playerId);
      return row ? LeaderboardEntry.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in getBestForPlayer', { playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve best player entry', error);
    }
  }

  async getPlayerRank(playerId) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }
      const result = this.stmts.getPlayerRank.get(playerId);
      return result ? result.rank : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in getPlayerRank', { playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve player rank', error);
    }
  }

  async cleanup(keepCount = 1000) {
    try {
      if (keepCount < 100 || keepCount > 10000) {
        throw new ValidationError('Keep count must be between 100 and 10000');
      }
      const result = this.stmts.cleanup.run(keepCount);
      logger.info('Leaderboard cleanup completed', { entriesDeleted: result.changes, kept: keepCount });
      return result.changes;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in cleanup', { keepCount, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to cleanup leaderboard', error);
    }
  }
}

module.exports = SQLiteLeaderboardRepository;
