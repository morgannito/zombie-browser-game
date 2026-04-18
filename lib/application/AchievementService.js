/**
 * ACHIEVEMENT SERVICE
 * Service layer for managing achievement unlocks
 * @version 2.0.0 - batch + progress cache + rare-event hooks
 */

const logger = require('../../infrastructure/logging/Logger');

class AchievementService {
  constructor(achievementRepository, playerRepository) {
    this.achievementRepository = achievementRepository;
    this.playerRepository = playerRepository;

    /** Map<playerId, Set<achievementId>> — unlocked IDs known in-process */
    this._unlockedCache = new Map();

    /** Map<playerId, Object> — last fetched player stats snapshot */
    this._statsCache = new Map();
  }

  /**
   * Warm the in-process unlocked cache for a player (call on login/spawn).
   * @param {string} playerId
   */
  async warmCache(playerId) {
    const rows = await this.achievementRepository.getPlayerAchievements(playerId);
    this._unlockedCache.set(playerId, new Set(rows.map(r => r.achievementId)));
  }

  /**
   * Evict cache entries for a player (call on disconnect).
   * @param {string} playerId
   */
  evictCache(playerId) {
    this._unlockedCache.delete(playerId);
    this._statsCache.delete(playerId);
  }

  /**
   * Called on rare gameplay events (boss kill, wave 50…).
   * Triggers a full achievement check for the player.
   * @param {string} playerId
   * @param {Object} sessionStats
   * @returns {Promise<Array>}
   */
  async onRareEvent(playerId, sessionStats = {}) {
    return this.checkAndUnlockAchievements(playerId, sessionStats);
  }

  /**
   * Check and unlock achievements for a player — single DB pass.
   * Uses in-process cache to skip already-unlocked achievements.
   * @param {string} playerId
   * @param {Object} sessionStats
   * @returns {Promise<Array>} Newly unlocked achievements
   */
  async checkAndUnlockAchievements(playerId, sessionStats = {}) {
    try {
      const [allAchievements, playerStats] = await Promise.all([
        this.achievementRepository.getAllAchievements(),
        this.playerRepository.getStats(playerId)
      ]);

      const unlocked = await this._getUnlockedSet(playerId);
      const candidates = this._filterCandidates(allAchievements, unlocked, playerStats);

      if (candidates.length === 0) {
return [];
}

      const newlyUnlocked = await this._batchPersist(playerId, candidates, sessionStats);

      newlyUnlocked.forEach(a => {
        unlocked.add(a.id);
        logger.info('Achievement unlocked', { playerId, achievementId: a.id, achievementName: a.name });
      });

      return newlyUnlocked;
    } catch (error) {
      logger.error('Failed to check achievements', { playerId, error: error.message, stack: error.stack });
      return [];
    }
  }

  /** @private */
  async _getUnlockedSet(playerId) {
    if (!this._unlockedCache.has(playerId)) {
      await this.warmCache(playerId);
    }
    return this._unlockedCache.get(playerId);
  }

  /** @private */
  _filterCandidates(all, unlocked, stats) {
    return all.filter(a => !unlocked.has(a.id) && a.checkRequirements(stats));
  }

  /**
   * Persist candidates — batch if supported, fallback to sequential.
   * @private
   */
  async _batchPersist(playerId, candidates, sessionStats) {
    const repo = this.achievementRepository;

    if (typeof repo.batchUnlockAchievements === 'function') {
      const inserted = repo.batchUnlockAchievements(playerId, candidates);
      // inserted is sync count; if 0 all were already in DB (race condition)
      return inserted > 0 ? candidates.slice(0, inserted) : [];
    }

    // Fallback: sequential for repos without batch support (e.g. test mocks)
    const results = [];
    for (const a of candidates) {
      const ok = await repo.unlockAchievement(playerId, a.id, sessionStats.sessionId);
      if (ok) {
results.push(a);
}
    }
    return results;
  }

  /**
   * Get player's achievement progress snapshot.
   * @param {string} playerId
   * @returns {Promise<Object>}
   */
  async getPlayerAchievementProgress(playerId) {
    try {
      const [allAchievements, playerAchievements] = await Promise.all([
        this.achievementRepository.getAllAchievements(),
        this.achievementRepository.getPlayerAchievements(playerId)
      ]);

      return this._buildProgressSnapshot(allAchievements, playerAchievements);
    } catch (error) {
      logger.error('Failed to get achievement progress', { playerId, error: error.message });
      throw error;
    }
  }

  /** @private */
  _buildProgressSnapshot(allAchievements, playerAchievements) {
    const unlockedIds = new Set(playerAchievements.map(a => a.achievementId));
    const unlocked = allAchievements.filter(a => unlockedIds.has(a.id));
    const locked = allAchievements.filter(a => !unlockedIds.has(a.id) && !a.hidden);

    const totalPoints = playerAchievements.reduce((s, a) => s + a.points, 0);
    const maxPoints = allAchievements.reduce((s, a) => s + a.points, 0);
    const percentComplete = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

    return {
      unlocked: unlocked.map(a => a.toObject()),
      locked: locked.map(a => a.toObject()),
      totalPoints,
      maxPoints,
      percentComplete,
      unlockedCount: unlocked.length,
      totalCount: allAchievements.length
    };
  }
}

module.exports = AchievementService;
