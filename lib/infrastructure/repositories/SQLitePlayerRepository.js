/**
 * SQLITE PLAYER REPOSITORY
 * Infrastructure implementation of IPlayerRepository
 */

const IPlayerRepository = require('../../domain/repositories/IPlayerRepository');
const Player = require('../../domain/entities/Player');
const { DatabaseError, NotFoundError, ValidationError } = require('../../domain/errors/DomainErrors');
const logger = require('../Logger');

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
    try {
      if (!id) {
        throw new ValidationError('Player ID is required');
      }
      const row = this.stmts.findById.get(id);
      return row ? Player.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findById', { id, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve player', error);
    }
  }

  async findByUsername(username) {
    try {
      if (!username) {
        throw new ValidationError('Username is required');
      }
      const row = this.stmts.findByUsername.get(username);
      return row ? Player.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findByUsername', { username, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve player by username', error);
    }
  }

  async create(player) {
    try {
      if (!player || !player.id || !player.username) {
        throw new ValidationError('Player with valid id and username is required');
      }

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
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // Check for unique constraint violation (SQLite error code)
      if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('UNIQUE constraint')) {
        logger.warn('Duplicate player creation attempt', { playerId: player.id, username: player.username });
        throw new ValidationError(`Player with id '${player.id}' or username '${player.username}' already exists`);
      }
      logger.error('Database error in create', { playerId: player.id, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to create player', error);
    }
  }

  async update(player) {
    try {
      if (!player || !player.id) {
        throw new ValidationError('Player with valid id is required for update');
      }

      const result = this.stmts.update.run(
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

      if (result.changes === 0) {
        throw new NotFoundError('Player', player.id);
      }

      return player;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Database error in update', { playerId: player.id, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to update player', error);
    }
  }

  async getTopPlayers(limit = 10) {
    try {
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }
      const rows = this.stmts.topPlayers.all(limit);
      return rows.map(row => Player.fromDB(row));
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in getTopPlayers', { limit, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve top players', error);
    }
  }

  async getStats(id) {
    try {
      if (!id) {
        throw new ValidationError('Player ID is required');
      }

      const player = await this.findById(id);
      if (!player) {
        throw new NotFoundError('Player', id);
      }

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
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Database error in getStats', { id, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve player stats', error);
    }
  }
}

module.exports = SQLitePlayerRepository;
