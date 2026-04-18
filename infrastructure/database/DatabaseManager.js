/**
 * @fileoverview SQLite connection manager — WAL mode, schema init, online backup.
 * @version 1.1.0
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../logging/Logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/game.db');
const DB_DIR = path.dirname(DB_PATH);

class DatabaseManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Open the database, apply PRAGMAs and create schema.
   * @throws {Error} If the database cannot be opened or schema creation fails.
   */
  initialize() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        logger.info('Created database directory', { path: DB_DIR });
      }

      this.db = new Database(DB_PATH, {
        verbose: logger.isDebugEnabled() ? logger.debug.bind(logger) : null
      });

      this._applyPragmas();
      logger.info('Database connection established', { path: DB_PATH });

      this.createSchema();
      this.isInitialized = true;
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply performance and safety PRAGMAs.
   * WAL autocheckpoint at 1000 pages prevents unbounded WAL growth (contention fix).
   * @private
   */
  _applyPragmas() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 134217728');
    this.db.pragma('wal_autocheckpoint = 1000');
  }

  /**
   * Create all tables inside a single transaction.
   * Each private helper creates one logical group of tables.
   */
  createSchema() {
    this.db.transaction(() => {
      this._createPlayersTable();
      this._createSessionsTable();
      this._createUpgradesTable();
      this._createLeaderboardTable();
      this._createProgressionTable();
      this._createSkillTreeTable();
      this._createAchievementsTable();
    })();
    logger.info('Database schema created');
  }

  /** @private */
  _createPlayersTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_seen INTEGER DEFAULT (strftime('%s', 'now')),
        total_kills INTEGER DEFAULT 0,
        total_deaths INTEGER DEFAULT 0,
        highest_wave INTEGER DEFAULT 0,
        highest_level INTEGER DEFAULT 0,
        total_playtime INTEGER DEFAULT 0,
        total_gold_earned INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
      CREATE INDEX IF NOT EXISTS idx_players_highest_wave ON players(highest_wave DESC);
    `);
  }

  /** @private */
  _createSessionsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        socket_id TEXT,
        state TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        disconnected_at INTEGER,
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_socket ON sessions(socket_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_disconnected ON sessions(disconnected_at) WHERE disconnected_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(player_id) WHERE disconnected_at IS NULL;
    `);
  }

  /** @private */
  _createUpgradesTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS permanent_upgrades (
        player_id TEXT PRIMARY KEY,
        max_health_level INTEGER DEFAULT 0,
        damage_level INTEGER DEFAULT 0,
        speed_level INTEGER DEFAULT 0,
        fire_rate_level INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
    `);
  }

  /** @private */
  _createLeaderboardTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        wave INTEGER NOT NULL,
        level INTEGER NOT NULL,
        kills INTEGER NOT NULL,
        survival_time INTEGER NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
      CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard(player_id);
    `);
  }

  /** @private */
  _createProgressionTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS account_progression (
        player_id TEXT PRIMARY KEY,
        account_level INTEGER DEFAULT 1,
        account_xp INTEGER DEFAULT 0,
        total_xp_earned INTEGER DEFAULT 0,
        skill_points INTEGER DEFAULT 0,
        prestige_level INTEGER DEFAULT 0,
        prestige_tokens INTEGER DEFAULT 0,
        unlocked_skills TEXT DEFAULT '[]',
        last_updated INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
      CREATE INDEX IF NOT EXISTS idx_progression_level ON account_progression(account_level DESC);
      CREATE INDEX IF NOT EXISTS idx_progression_prestige ON account_progression(prestige_level DESC);
    `);
  }

  /** @private */
  _createSkillTreeTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_tree (
        skill_id TEXT PRIMARY KEY,
        skill_name TEXT NOT NULL,
        skill_description TEXT,
        skill_category TEXT NOT NULL,
        tier INTEGER NOT NULL,
        skill_cost INTEGER NOT NULL,
        max_rank INTEGER DEFAULT 1,
        icon_emoji TEXT,
        prerequisite_skills TEXT DEFAULT '[]',
        effects_json TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_skill_category ON skill_tree(skill_category);
      CREATE INDEX IF NOT EXISTS idx_skill_tier ON skill_tree(tier);
    `);
  }

  /** @private */
  _createAchievementsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS achievements (
        achievement_id TEXT PRIMARY KEY,
        achievement_name TEXT NOT NULL,
        achievement_description TEXT,
        category TEXT NOT NULL,
        tier TEXT DEFAULT 'bronze',
        unlock_criteria_json TEXT NOT NULL,
        reward_type TEXT,
        reward_value INTEGER DEFAULT 0,
        icon_emoji TEXT,
        is_secret INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS player_achievements (
        player_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at INTEGER DEFAULT (strftime('%s', 'now')),
        progress_current INTEGER DEFAULT 0,
        progress_required INTEGER NOT NULL,
        PRIMARY KEY (player_id, achievement_id),
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id)
      );
      CREATE INDEX IF NOT EXISTS idx_player_achievements ON player_achievements(player_id);
      CREATE INDEX IF NOT EXISTS idx_achievement_unlocked ON player_achievements(unlocked_at DESC);
      CREATE TABLE IF NOT EXISTS daily_challenges (
        challenge_date TEXT NOT NULL PRIMARY KEY,
        challenges_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS player_daily_challenges (
        player_id TEXT NOT NULL,
        challenge_date TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        reward_claimed INTEGER DEFAULT 0,
        claimed_at INTEGER,
        PRIMARY KEY (player_id, challenge_date, challenge_id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
      CREATE INDEX IF NOT EXISTS idx_player_daily_challenges ON player_daily_challenges(player_id, challenge_date);
    `);
  }

  /**
   * Return the raw better-sqlite3 Database instance.
   * @returns {import('better-sqlite3').Database}
   * @throws {Error} If not yet initialized.
   */
  getDb() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  /**
   * Create an online backup using the better-sqlite3 async backup API.
   * Non-blocking: uses page-by-page transfer so WAL readers are not blocked.
   * @param {string} backupPath - Destination file path.
   * @returns {Promise<void>}
   */
  async backup(backupPath) {
    if (!this.db) return;
    try {
      await this.db.backup(backupPath);
      logger.info('Database backup created', { path: backupPath });
    } catch (error) {
      logger.error('Failed to create backup', { error: error.message });
    }
  }
}

/** @type {DatabaseManager|null} */
let instance = null;

module.exports = {
  /**
   * Return the singleton DatabaseManager instance.
   * @returns {DatabaseManager}
   */
  getInstance: () => {
    if (!instance) {
      instance = new DatabaseManager();
    }
    return instance;
  }
};
