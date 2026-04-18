/**
 * SQLITE UPGRADES REPOSITORY
 * Infrastructure implementation
 */

const IUpgradesRepository = require('../../domain/repositories/IUpgradesRepository');
const PermanentUpgrades = require('../../domain/entities/PermanentUpgrades');
const { DatabaseError, ValidationError } = require('../../domain/errors/DomainErrors');
const logger = require('../../../infrastructure/logging/Logger');

/** Explicit column list to avoid leaking future columns */
const UPGRADES_COLS = 'player_id, max_health_level, damage_level, speed_level, fire_rate_level, updated_at';

class SQLiteUpgradesRepository extends IUpgradesRepository {
  constructor(db) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findByPlayerId: this.db.prepare(`SELECT ${UPGRADES_COLS} FROM permanent_upgrades WHERE player_id = ?`),
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

  /**
   * Find upgrades record for a player.
   * @param {string} playerId
   * @returns {Promise<PermanentUpgrades|null>}
   */
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
      logger.error('Database error in findByPlayerId', { playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to retrieve upgrades', error);
    }
  }

  /**
   * Create a new upgrades record.
   * @param {PermanentUpgrades} upgrades
   * @returns {Promise<PermanentUpgrades>}
   */
  async create(upgrades) {
    try {
      if (!upgrades || !upgrades.playerId) {
throw new ValidationError('Upgrades with valid playerId is required');
}
      this.stmts.create.run(
        upgrades.playerId, upgrades.maxHealthLevel, upgrades.damageLevel,
        upgrades.speedLevel, upgrades.fireRateLevel
      );
      return upgrades;
    } catch (error) {
      if (error instanceof ValidationError) {
throw error;
}
      logger.error('Database error in create', { playerId: upgrades.playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to create upgrades', error);
    }
  }

  /**
   * Update an existing upgrades record.
   * @param {PermanentUpgrades} upgrades
   * @returns {Promise<PermanentUpgrades>}
   */
  async update(upgrades) {
    try {
      if (!upgrades || !upgrades.playerId) {
throw new ValidationError('Upgrades with valid playerId is required for update');
}
      this.stmts.update.run(
        upgrades.maxHealthLevel, upgrades.damageLevel,
        upgrades.speedLevel, upgrades.fireRateLevel, upgrades.playerId
      );
      return upgrades;
    } catch (error) {
      if (error instanceof ValidationError) {
throw error;
}
      logger.error('Database error in update', { playerId: upgrades.playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to update upgrades', error);
    }
  }

  /**
   * Get or create an upgrades record atomically (transaction prevents race condition).
   * @param {string} playerId
   * @returns {Promise<PermanentUpgrades>}
   */
  async getOrCreate(playerId) {
    try {
      if (!playerId) {
throw new ValidationError('Player ID is required');
}
      return this._getOrCreateTx(playerId);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
throw error;
}
      logger.error('Database error in getOrCreate', { playerId, error: error.message, stack: error.stack });
      throw new DatabaseError('Failed to get or create upgrades', error);
    }
  }

  /**
   * Atomically get-or-create, apply a mutation, and persist in a single transaction.
   * Prevents TOCTOU races on shop buy (e.g. double-spending or over-leveling).
   * @param {string} playerId
   * @param {(upgrades: PermanentUpgrades) => void} mutateFn - throws on rule violation
   * @returns {PermanentUpgrades}
   */
  upgradeAtomic(playerId, mutateFn) {
    const tx = this.db.transaction(() => {
      const row = this.stmts.findByPlayerId.get(playerId);
      let upgrades;
      if (row) {
        upgrades = PermanentUpgrades.fromDB(row);
      } else {
        upgrades = new PermanentUpgrades({ playerId });
        this.stmts.create.run(
          upgrades.playerId, upgrades.maxHealthLevel, upgrades.damageLevel,
          upgrades.speedLevel, upgrades.fireRateLevel
        );
      }
      mutateFn(upgrades); // throws on business rule violation (e.g. max level)
      this.stmts.update.run(
        upgrades.maxHealthLevel, upgrades.damageLevel,
        upgrades.speedLevel, upgrades.fireRateLevel, upgrades.playerId
      );
      return upgrades;
    });
    return tx();
  }

  /**
   * @private
   * Runs find+create inside a single SQLite transaction to prevent race conditions.
   * @param {string} playerId
   * @returns {PermanentUpgrades}
   */
  _getOrCreateTx(playerId) {
    const tx = this.db.transaction(() => {
      const row = this.stmts.findByPlayerId.get(playerId);
      if (row) {
return PermanentUpgrades.fromDB(row);
}
      const upgrades = new PermanentUpgrades({ playerId });
      this.stmts.create.run(
        upgrades.playerId, upgrades.maxHealthLevel, upgrades.damageLevel,
        upgrades.speedLevel, upgrades.fireRateLevel
      );
      return upgrades;
    });
    return tx();
  }
}

module.exports = SQLiteUpgradesRepository;
