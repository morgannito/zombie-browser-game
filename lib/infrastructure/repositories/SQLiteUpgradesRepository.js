/**
 * SQLITE UPGRADES REPOSITORY
 * Infrastructure implementation
 */

const IUpgradesRepository = require('../../domain/repositories/IUpgradesRepository');
const PermanentUpgrades = require('../../domain/entities/PermanentUpgrades');

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
    const row = this.stmts.findByPlayerId.get(playerId);
    return row ? PermanentUpgrades.fromDB(row) : null;
  }

  async create(upgrades) {
    this.stmts.create.run(
      upgrades.playerId,
      upgrades.maxHealthLevel,
      upgrades.damageLevel,
      upgrades.speedLevel,
      upgrades.fireRateLevel
    );
    return upgrades;
  }

  async update(upgrades) {
    this.stmts.update.run(
      upgrades.maxHealthLevel,
      upgrades.damageLevel,
      upgrades.speedLevel,
      upgrades.fireRateLevel,
      upgrades.playerId
    );
    return upgrades;
  }

  async getOrCreate(playerId) {
    let upgrades = await this.findByPlayerId(playerId);

    if (!upgrades) {
      upgrades = new PermanentUpgrades({ playerId });
      await this.create(upgrades);
    }

    return upgrades;
  }
}

module.exports = SQLiteUpgradesRepository;
