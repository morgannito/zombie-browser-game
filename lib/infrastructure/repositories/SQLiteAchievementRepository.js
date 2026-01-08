/**
 * SQLITE ACHIEVEMENT REPOSITORY
 * Infrastructure implementation for achievements
 * @version 1.0.0
 */

const Achievement = require('../../domain/entities/Achievement');
const { DatabaseError } = require('../../domain/errors/DomainErrors');
const logger = require('../Logger');

class SQLiteAchievementRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      getAllAchievements: this.db.prepare('SELECT * FROM achievements ORDER BY category, sort_order'),
      getAchievementById: this.db.prepare('SELECT * FROM achievements WHERE achievement_id = ?'),
      getPlayerAchievements: this.db.prepare(`
        SELECT pa.*, a.achievement_name, a.achievement_description, a.tier, a.icon_emoji, a.reward_type, a.reward_value
        FROM player_achievements pa
        JOIN achievements a ON pa.achievement_id = a.achievement_id
        WHERE pa.player_id = ?
        ORDER BY pa.unlocked_at DESC
      `),
      unlockAchievement: this.db.prepare(`
        INSERT OR IGNORE INTO player_achievements (player_id, achievement_id, progress_current, progress_required)
        VALUES (?, ?, ?, ?)
      `),
      updateProgress: this.db.prepare(`
        UPDATE player_achievements
        SET progress_current = ?
        WHERE player_id = ? AND achievement_id = ?
      `),
      hasAchievement: this.db.prepare(`
        SELECT COUNT(*) as count FROM player_achievements
        WHERE player_id = ? AND achievement_id = ?
      `)
    };
  }

  async getAllAchievements() {
    try {
      const rows = this.stmts.getAllAchievements.all();
      return rows.map(row => new Achievement({
        id: row.achievement_id,
        category: row.category,
        name: row.achievement_name,
        description: row.achievement_description,
        iconUrl: row.icon_emoji,
        rewardType: row.reward_type,
        rewardValue: row.reward_value,
        tier: row.tier,
        requirementJson: row.unlock_criteria_json,
        hidden: row.is_secret === 1,
        sortOrder: row.sort_order
      }));
    } catch (error) {
      logger.error('Database error in getAllAchievements', { error: error.message });
      throw new DatabaseError('Failed to retrieve achievements', error);
    }
  }

  async getAchievementById(id) {
    try {
      const row = this.stmts.getAchievementById.get(id);
      if (!row) {
        return null;
      }

      return new Achievement({
        id: row.achievement_id,
        category: row.category,
        name: row.achievement_name,
        description: row.achievement_description,
        iconUrl: row.icon_emoji,
        rewardType: row.reward_type,
        rewardValue: row.reward_value,
        tier: row.tier,
        requirementJson: row.unlock_criteria_json,
        hidden: row.is_secret === 1,
        sortOrder: row.sort_order
      });
    } catch (error) {
      logger.error('Database error in getAchievementById', { id, error: error.message });
      throw new DatabaseError('Failed to retrieve achievement', error);
    }
  }

  async getPlayerAchievements(playerId) {
    try {
      const rows = this.stmts.getPlayerAchievements.all(playerId);
      return rows.map(row => ({
        achievementId: row.achievement_id,
        name: row.achievement_name,
        description: row.achievement_description,
        rewardType: row.reward_type,
        rewardValue: row.reward_value,
        tier: row.tier,
        iconUrl: row.icon_emoji,
        unlockedAt: row.unlocked_at * 1000,
        progressCurrent: row.progress_current,
        progressRequired: row.progress_required
      }));
    } catch (error) {
      logger.error('Database error in getPlayerAchievements', { playerId, error: error.message });
      throw new DatabaseError('Failed to retrieve player achievements', error);
    }
  }

  async unlockAchievement(playerId, achievementId, progressRequired = 1) {
    try {
      const result = this.stmts.unlockAchievement.run(playerId, achievementId, progressRequired, progressRequired);
      return result.changes > 0;
    } catch (error) {
      logger.error('Database error in unlockAchievement', {
        playerId,
        achievementId,
        error: error.message
      });
      throw new DatabaseError('Failed to unlock achievement', error);
    }
  }

  async updateProgress(playerId, achievementId, progress) {
    try {
      this.stmts.updateProgress.run(progress, playerId, achievementId);
    } catch (error) {
      logger.error('Database error in updateProgress', {
        playerId,
        achievementId,
        progress,
        error: error.message
      });
      throw new DatabaseError('Failed to update achievement progress', error);
    }
  }

  async hasAchievement(playerId, achievementId) {
    try {
      const row = this.stmts.hasAchievement.get(playerId, achievementId);
      return row.count > 0;
    } catch (error) {
      logger.error('Database error in hasAchievement', {
        playerId,
        achievementId,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = SQLiteAchievementRepository;
