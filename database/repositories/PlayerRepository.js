/**
 * PLAYER REPOSITORY - SQLite Implementation
 * Data access layer for player operations
 * @version 1.0.0
 */

const IPlayerRepository = require('./IPlayerRepository');

class PlayerRepository extends IPlayerRepository {
  /**
   * @param {Database} db - better-sqlite3 database instance
   */
  constructor(db) {
    super();
    this.db = db;
    this._prepareStatements();
  }

  /**
   * Prepare compiled statements for performance
   * @private
   */
  _prepareStatements() {
    // Player queries
    this.stmts = {
      createPlayer: this.db.prepare(`
        INSERT INTO players (player_uuid, nickname, email, password_hash, last_login_at)
        VALUES (?, ?, ?, ?, ?)
      `),

      findById: this.db.prepare(`
        SELECT * FROM players WHERE id = ?
      `),

      findByUuid: this.db.prepare(`
        SELECT * FROM players WHERE player_uuid = ?
      `),

      findByNickname: this.db.prepare(`
        SELECT * FROM players WHERE nickname = ? COLLATE NOCASE
      `),

      checkNickname: this.db.prepare(`
        SELECT COUNT(*) as count FROM players WHERE nickname = ? COLLATE NOCASE
      `),

      updateLastLogin: this.db.prepare(`
        UPDATE players SET last_login_at = ? WHERE id = ?
      `),

      // Stats queries
      getStats: this.db.prepare(`
        SELECT * FROM player_stats WHERE player_id = ?
      `),

      updateStats: this.db.prepare(`
        UPDATE player_stats SET
          total_kills = total_kills + ?,
          zombies_killed = zombies_killed + ?,
          boss_kills = boss_kills + ?,
          highest_combo = MAX(highest_combo, ?),
          total_damage_dealt = total_damage_dealt + ?,
          total_damage_taken = total_damage_taken + ?,
          shots_fired = shots_fired + ?,
          shots_hit = shots_hit + ?,
          headshots = headshots + ?,
          total_xp_earned = total_xp_earned + ?,
          total_gold_earned = total_gold_earned + ?,
          total_gold_spent = total_gold_spent + ?
        WHERE player_id = ?
      `),

      // Permanent upgrades
      getPermanentUpgrades: this.db.prepare(`
        SELECT upgrade_type, upgrade_level, total_invested
        FROM permanent_upgrades
        WHERE player_id = ?
      `),

      getUpgradeLevel: this.db.prepare(`
        SELECT upgrade_level, total_invested
        FROM permanent_upgrades
        WHERE player_id = ? AND upgrade_type = ?
      `),

      insertOrUpdateUpgrade: this.db.prepare(`
        INSERT INTO permanent_upgrades (player_id, upgrade_type, upgrade_level, total_invested)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(player_id, upgrade_type)
        DO UPDATE SET
          upgrade_level = upgrade_level + 1,
          total_invested = total_invested + excluded.total_invested
      `),

      // Unlocks
      getUnlocks: this.db.prepare(`
        SELECT unlock_type, unlock_id, unlock_tier, purchased_at, equipped
        FROM player_unlocks
        WHERE player_id = ?
      `),

      getUnlocksByType: this.db.prepare(`
        SELECT unlock_type, unlock_id, unlock_tier, purchased_at, equipped
        FROM player_unlocks
        WHERE player_id = ? AND unlock_type = ?
      `),

      addUnlock: this.db.prepare(`
        INSERT INTO player_unlocks (player_id, unlock_type, unlock_id, purchase_price)
        VALUES (?, ?, ?, ?)
      `),

      // Bans
      banPlayer: this.db.prepare(`
        UPDATE players
        SET is_banned = 1, ban_reason = ?, ban_expires_at = ?
        WHERE id = ?
      `),

      checkBan: this.db.prepare(`
        SELECT is_banned, ban_reason, ban_expires_at
        FROM players
        WHERE id = ?
      `),
    };
  }

  /**
   * Create a new player
   * @param {Object} playerData - Player data
   * @returns {Promise<Object>} Created player with id
   */
  async create(playerData) {
    const now = Math.floor(Date.now() / 1000);
    const result = this.stmts.createPlayer.run(
      playerData.playerUuid,
      playerData.nickname,
      playerData.email || null,
      playerData.passwordHash || null,
      now
    );

    return {
      id: result.lastInsertRowid,
      playerUuid: playerData.playerUuid,
      nickname: playerData.nickname,
      email: playerData.email || null,
      createdAt: now,
      lastLoginAt: now
    };
  }

  /**
   * Find player by ID
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>}
   */
  async findById(playerId) {
    return this.stmts.findById.get(playerId) || null;
  }

  /**
   * Find player by UUID
   * @param {string} playerUuid - Player UUID
   * @returns {Promise<Object|null>}
   */
  async findByUuid(playerUuid) {
    return this.stmts.findByUuid.get(playerUuid) || null;
  }

  /**
   * Find player by nickname
   * @param {string} nickname - Player nickname
   * @returns {Promise<Object|null>}
   */
  async findByNickname(nickname) {
    return this.stmts.findByNickname.get(nickname) || null;
  }

  /**
   * Check if nickname is available
   * @param {string} nickname - Nickname to check
   * @returns {Promise<boolean>}
   */
  async isNicknameAvailable(nickname) {
    const result = this.stmts.checkNickname.get(nickname);
    return result.count === 0;
  }

  /**
   * Update player last login timestamp
   * @param {number} playerId - Player ID
   * @returns {Promise<void>}
   */
  async updateLastLogin(playerId) {
    const now = Math.floor(Date.now() / 1000);
    this.stmts.updateLastLogin.run(now, playerId);
  }

  /**
   * Get player with full stats
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>}
   */
  async getPlayerProfile(playerId) {
    const stmt = this.db.prepare(`
      SELECT
        p.*,
        ps.total_kills,
        ps.zombies_killed,
        ps.highest_level,
        ps.highest_wave,
        ps.highest_combo,
        ps.games_played,
        ps.total_playtime_seconds,
        COUNT(DISTINCT pa.achievement_id) as achievements_count
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      LEFT JOIN player_achievements pa ON p.id = pa.player_id
      WHERE p.id = ?
      GROUP BY p.id
    `);

    return stmt.get(playerId) || null;
  }

  /**
   * Get player stats
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>}
   */
  async getStats(playerId) {
    return this.stmts.getStats.get(playerId) || null;
  }

  /**
   * Update player stats (incremental)
   * @param {number} playerId - Player ID
   * @param {Object} updates - Stat updates
   * @returns {Promise<void>}
   */
  async updateStats(playerId, updates) {
    this.stmts.updateStats.run(
      updates.totalKills || 0,
      updates.zombiesKilled || 0,
      updates.bossKills || 0,
      updates.highestCombo || 0,
      updates.totalDamageDealt || 0,
      updates.totalDamageTaken || 0,
      updates.shotsFired || 0,
      updates.shotsHit || 0,
      updates.headshots || 0,
      updates.totalXpEarned || 0,
      updates.totalGoldEarned || 0,
      updates.totalGoldSpent || 0,
      playerId
    );
  }

  /**
   * Get permanent upgrades for player
   * @param {number} playerId - Player ID
   * @returns {Promise<Object>}
   */
  async getPermanentUpgrades(playerId) {
    const rows = this.stmts.getPermanentUpgrades.all(playerId);
    const upgrades = {};

    for (const row of rows) {
      upgrades[row.upgrade_type] = {
        level: row.upgrade_level,
        invested: row.total_invested
      };
    }

    return upgrades;
  }

  /**
   * Purchase permanent upgrade
   * @param {number} playerId - Player ID
   * @param {string} upgradeType - Type of upgrade
   * @param {number} cost - Gold cost
   * @returns {Promise<boolean>}
   */
  async purchaseUpgrade(playerId, upgradeType, cost) {
    // Transaction to ensure atomicity
    const transaction = this.db.transaction(() => {
      // Check player has enough gold
      const stats = this.stmts.getStats.get(playerId);
      const availableGold = stats.total_gold_earned - stats.total_gold_spent;

      if (availableGold < cost) {
        return false;
      }

      // Deduct gold
      const updateGoldStmt = this.db.prepare(`
        UPDATE player_stats
        SET total_gold_spent = total_gold_spent + ?
        WHERE player_id = ?
      `);
      updateGoldStmt.run(cost, playerId);

      // Add/upgrade the upgrade
      this.stmts.insertOrUpdateUpgrade.run(playerId, upgradeType, 1, cost);

      return true;
    });

    return transaction();
  }

  /**
   * Get player unlocks
   * @param {number} playerId - Player ID
   * @param {string|null} unlockType - Optional filter by type
   * @returns {Promise<Array>}
   */
  async getUnlocks(playerId, unlockType = null) {
    if (unlockType) {
      return this.stmts.getUnlocksByType.all(playerId, unlockType);
    }
    return this.stmts.getUnlocks.all(playerId);
  }

  /**
   * Add unlock for player
   * @param {number} playerId - Player ID
   * @param {string} unlockType - Type of unlock
   * @param {string} unlockId - ID of item to unlock
   * @param {number} price - Purchase price
   * @returns {Promise<void>}
   */
  async addUnlock(playerId, unlockType, unlockId, price) {
    this.stmts.addUnlock.run(playerId, unlockType, unlockId, price);
  }

  /**
   * Ban player
   * @param {number} playerId - Player ID
   * @param {string} reason - Ban reason
   * @param {number|null} expiresAt - Unix timestamp or null for permanent
   * @returns {Promise<void>}
   */
  async banPlayer(playerId, reason, expiresAt = null) {
    this.stmts.banPlayer.run(reason, expiresAt, playerId);
  }

  /**
   * Check if player is banned
   * @param {number} playerId - Player ID
   * @returns {Promise<boolean>}
   */
  async isBanned(playerId) {
    const result = this.stmts.checkBan.get(playerId);
    if (!result || !result.is_banned) {
      return false;
    }

    // Check if temporary ban has expired
    if (result.ban_expires_at) {
      const now = Math.floor(Date.now() / 1000);
      if (now > result.ban_expires_at) {
        // Unban
        const unbanStmt = this.db.prepare(`
          UPDATE players SET is_banned = 0, ban_expires_at = NULL WHERE id = ?
        `);
        unbanStmt.run(playerId);
        return false;
      }
    }

    return true;
  }
}

module.exports = PlayerRepository;