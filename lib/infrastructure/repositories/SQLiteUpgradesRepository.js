/**
 * SQLITE UPGRADES REPOSITORY
 * Infrastructure implementation
 */

const IUpgradesRepository = require('../../domain/repositories/IUpgradesRepository');
const PermanentUpgrades = require('../../domain/entities/PermanentUpgrades');
const { DatabaseError, ValidationError } = require('../../domain/errors/DomainErrors');
const logger = require('../Logger');

class SQLiteUpgradesRepository extends IUpgradesRepository {
  constructor(db) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findByPlayerId: this.db.prepare('SELECT * FROM permanent_upgrades WHERE player_id = ?'),
      create: this.db.prepare(`
        INSERT INTO permanent_upgrades (player_id, max_health_level, damage_level, speed_level, fire_rate_level)
        VALUES (?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE permanent_upgrades
        SET max_health_level = ?, damage_level = ?, speed_level = ?, fire_rate_level = ?,
            updated_at = strftime('%s', 'now')
        WHERE player_id = ?
      `)
    };
  }

  async findByPlayerId(playerId) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }
      const row = this.stmts.findByPlayerId.get(playerId);
      return row ? PermanentUpgrades.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findByPlayerId', {
        playerId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to retrieve upgrades', error);
    }
  }

  async create(upgrades) {
    try {
      if (!upgrades || !upgrades.playerId) {
        throw new ValidationError('Upgrades with valid playerId is required');
      }
      this.stmts.create.run(
        upgrades.playerId,
        upgrades.maxHealthLevel,
        upgrades.damageLevel,
        upgrades.speedLevel,
        upgrades.fireRateLevel
      );
      return upgrades;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in create', {
        playerId: upgrades.playerId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to create upgrades', error);
    }
  }

  async update(upgrades) {
    try {
      if (!upgrades || !upgrades.playerId) {
        throw new ValidationError('Upgrades with valid playerId is required for update');
      }
      this.stmts.update.run(
        upgrades.maxHealthLevel,
        upgrades.damageLevel,
        upgrades.speedLevel,
        upgrades.fireRateLevel,
        upgrades.playerId
      );
      return upgrades;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in update', {
        playerId: upgrades.playerId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to update upgrades', error);
    }
  }

  async getOrCreate(playerId) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }
      let upgrades = await this.findByPlayerId(playerId);
      if (!upgrades) {
        upgrades = new PermanentUpgrades({ playerId });
        await this.create(upgrades);
      }
      return upgrades;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      logger.error('Database error in getOrCreate', {
        playerId,
        error: error.message,
        stack: error.stack
      });
      throw new DatabaseError('Failed to get or create upgrades', error);
    }
  }
}

module.exports = SQLiteUpgradesRepository;
