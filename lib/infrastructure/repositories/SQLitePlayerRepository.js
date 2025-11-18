/**
 * SQLITE PLAYER REPOSITORY
 * Infrastructure implementation of IPlayerRepository
 */

const IPlayerRepository = require('../../domain/repositories/IPlayerRepository');
const Player = require('../../domain/entities/Player');

class SQLitePlayerRepository extends IPlayerRepository {
  constructor(db) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findById: this.db.prepare('SELECT * FROM players WHERE id = ?'),
      findByUsername: this.db.prepare('SELECT * FROM players WHERE username = ?'),
      create: this.db.prepare(`
        INSERT INTO players (id, username, total_kills, total_deaths, highest_wave, highest_level, total_playtime, total_gold_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE players
        SET username = ?, total_kills = ?, total_deaths = ?, highest_wave = ?,
            highest_level = ?, total_playtime = ?, total_gold_earned = ?, last_seen = ?
        WHERE id = ?
      `),
      topPlayers: this.db.prepare(`
        SELECT * FROM players
        ORDER BY highest_wave DESC, highest_level DESC, total_kills DESC
        LIMIT ?
      `)
    };
  }

  async findById(id) {
    const row = this.stmts.findById.get(id);
    return row ? Player.fromDB(row) : null;
  }

  async findByUsername(username) {
    const row = this.stmts.findByUsername.get(username);
    return row ? Player.fromDB(row) : null;
  }

  async create(player) {
    this.stmts.create.run(
      player.id,
      player.username,
      player.totalKills,
      player.totalDeaths,
      player.highestWave,
      player.highestLevel,
      player.totalPlaytime,
      player.totalGoldEarned
    );
    return player;
  }

  async update(player) {
    this.stmts.update.run(
      player.username,
      player.totalKills,
      player.totalDeaths,
      player.highestWave,
      player.highestLevel,
      player.totalPlaytime,
      player.totalGoldEarned,
      Math.floor(player.lastSeen / 1000), // Convert to seconds
      player.id
    );
    return player;
  }

  async getTopPlayers(limit = 10) {
    const rows = this.stmts.topPlayers.all(limit);
    return rows.map(row => Player.fromDB(row));
  }

  async getStats(id) {
    const player = await this.findById(id);
    if (!player) return null;

    return {
      totalKills: player.totalKills,
      totalDeaths: player.totalDeaths,
      kdRatio: player.getKDRatio(),
      highestWave: player.highestWave,
      highestLevel: player.highestLevel,
      totalPlaytime: player.totalPlaytime,
      totalGoldEarned: player.totalGoldEarned,
      score: player.calculateScore()
    };
  }
}

module.exports = SQLitePlayerRepository;
