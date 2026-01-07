/**
 * SQLITE PROGRESSION REPOSITORY
 * Infrastructure implementation for account progression
 * @version 1.0.0
 */

const AccountProgression = require('../../domain/entities/AccountProgression');
const { DatabaseError, NotFoundError, ValidationError } = require('../../domain/errors/DomainErrors');
const logger = require('../Logger');

class SQLiteProgressionRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findByPlayerId: this.db.prepare('SELECT * FROM account_progression WHERE player_id = ?'),
      create: this.db.prepare(`
        INSERT INTO account_progression (
          player_id, account_level, account_xp, total_xp_earned,
          skill_points, prestige_level, prestige_tokens, unlocked_skills
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE account_progression
        SET account_level = ?, account_xp = ?, total_xp_earned = ?,
            skill_points = ?, prestige_level = ?, prestige_tokens = ?,
            unlocked_skills = ?, last_updated = ?
        WHERE player_id = ?
      `),
      getTopByLevel: this.db.prepare(`
        SELECT ap.*, p.username
        FROM account_progression ap
        JOIN players p ON ap.player_id = p.id
        ORDER BY ap.account_level DESC, ap.total_xp_earned DESC
        LIMIT ?
      `),
      getTopByPrestige: this.db.prepare(`
        SELECT ap.*, p.username
        FROM account_progression ap
        JOIN players p ON ap.player_id = p.id
        ORDER BY ap.prestige_level DESC, ap.account_level DESC
        LIMIT ?
      `),
      getAllSkills: this.db.prepare(`
        SELECT * FROM skill_tree ORDER BY tier, sort_order
      `),
      getSkillById: this.db.prepare(`
        SELECT * FROM skill_tree WHERE skill_id = ?
      `)
    };
  }

  async findByPlayerId(playerId) {
    try {
      if (!playerId) {
        throw new ValidationError('Player ID is required');
      }

      const row = this.stmts.findByPlayerId.get(playerId);
      return row ? AccountProgression.fromDB(row) : null;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in findByPlayerId', { playerId, error: error.message });
      throw new DatabaseError('Failed to retrieve account progression', error);
    }
  }

  async create(progression) {
    try {
      if (!progression || !progression.playerId) {
        throw new ValidationError('Valid progression with player ID is required');
      }

      this.stmts.create.run(
        progression.playerId,
        progression.accountLevel,
        progression.accountXP,
        progression.totalXPEarned,
        progression.skillPoints,
        progression.prestigeLevel,
        progression.prestigeTokens,
        JSON.stringify(progression.unlockedSkills)
      );

      return progression;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Database error in create', { playerId: progression.playerId, error: error.message });
      throw new DatabaseError('Failed to create account progression', error);
    }
  }

  async update(progression) {
    try {
      if (!progression || !progression.playerId) {
        throw new ValidationError('Valid progression with player ID is required');
      }

      const result = this.stmts.update.run(
        progression.accountLevel,
        progression.accountXP,
        progression.totalXPEarned,
        progression.skillPoints,
        progression.prestigeLevel,
        progression.prestigeTokens,
        JSON.stringify(progression.unlockedSkills),
        Math.floor(progression.lastUpdated / 1000),
        progression.playerId
      );

      if (result.changes === 0) {
        throw new NotFoundError('AccountProgression', progression.playerId);
      }

      return progression;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Database error in update', { playerId: progression.playerId, error: error.message });
      throw new DatabaseError('Failed to update account progression', error);
    }
  }

  async getTopByLevel(limit = 10) {
    try {
      const rows = this.stmts.getTopByLevel.all(limit);
      return rows.map(row => ({
        progression: AccountProgression.fromDB(row),
        username: row.username
      }));
    } catch (error) {
      logger.error('Database error in getTopByLevel', { error: error.message });
      throw new DatabaseError('Failed to retrieve top players by level', error);
    }
  }

  async getTopByPrestige(limit = 10) {
    try {
      const rows = this.stmts.getTopByPrestige.all(limit);
      return rows.map(row => ({
        progression: AccountProgression.fromDB(row),
        username: row.username
      }));
    } catch (error) {
      logger.error('Database error in getTopByPrestige', { error: error.message });
      throw new DatabaseError('Failed to retrieve top players by prestige', error);
    }
  }

  async getAllSkills() {
    try {
      const rows = this.stmts.getAllSkills.all();
      return rows.map(row => ({
        skillId: row.skill_id,
        skillName: row.skill_name,
        description: row.skill_description,
        category: row.skill_category,
        tier: row.tier,
        cost: row.skill_cost,
        maxRank: row.max_rank,
        icon: row.icon_emoji,
        prerequisites: JSON.parse(row.prerequisite_skills || '[]'),
        effects: JSON.parse(row.effects_json),
        sortOrder: row.sort_order
      }));
    } catch (error) {
      logger.error('Database error in getAllSkills', { error: error.message });
      throw new DatabaseError('Failed to retrieve skill tree', error);
    }
  }

  async getSkillById(skillId) {
    try {
      const row = this.stmts.getSkillById.get(skillId);
      if (!row) return null;

      return {
        skillId: row.skill_id,
        skillName: row.skill_name,
        description: row.skill_description,
        category: row.skill_category,
        tier: row.tier,
        cost: row.skill_cost,
        maxRank: row.max_rank,
        icon: row.icon_emoji,
        prerequisites: JSON.parse(row.prerequisite_skills || '[]'),
        effects: JSON.parse(row.effects_json)
      };
    } catch (error) {
      logger.error('Database error in getSkillById', { skillId, error: error.message });
      throw new DatabaseError('Failed to retrieve skill', error);
    }
  }
}

module.exports = SQLiteProgressionRepository;
