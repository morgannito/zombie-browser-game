/**
 * SQLITE LEADERBOARD REPOSITORY
 * Infrastructure implementation
 */

const ILeaderboardRepository = require('../../domain/repositories/ILeaderboardRepository');
const LeaderboardEntry = require('../../domain/entities/LeaderboardEntry');

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
  }

  async getTop(limit = 10) {
    const rows = this.stmts.getTop.all(limit);
    return rows.map(row => LeaderboardEntry.fromDB(row));
  }

  async getByPlayer(playerId, limit = 10) {
    const rows = this.stmts.getByPlayer.all(playerId, limit);
    return rows.map(row => LeaderboardEntry.fromDB(row));
  }

  async getBestForPlayer(playerId) {
    const row = this.stmts.getBestForPlayer.get(playerId);
    return row ? LeaderboardEntry.fromDB(row) : null;
  }

  async getPlayerRank(playerId) {
    const result = this.stmts.getPlayerRank.get(playerId);
    return result ? result.rank : null;
  }

  async cleanup(keepCount = 1000) {
    const result = this.stmts.cleanup.run(keepCount);
    return result.changes;
  }
}

module.exports = SQLiteLeaderboardRepository;
