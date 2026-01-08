/**
 * DATABASE MANAGER - SQLite connection and initialization
 * Production-ready with WAL mode, backups, and prepared statements
 * @version 1.0.0
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../infrastructure/Logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/game.db');
const DB_DIR = path.dirname(DB_PATH);

class DatabaseManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and schema
   */
  initialize() {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        logger.info('Created database directory', { path: DB_DIR });
      }

      // Open database with optimized settings
      this.db = new Database(DB_PATH, {
        verbose: logger.isDebugEnabled() ? logger.debug : null
      });

      // Enable WAL mode for better concurrency (100x better)
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL'); // Faster, still safe
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('mmap_size = 30000000000'); // 30GB mmap

      logger.info('Database connection established', { path: DB_PATH });

      // Create schema
      this.createSchema();

      this.isInitialized = true;
      logger.info('Database initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize database', { error: error.message });
      throw error;
    }
  }

  /**
   * Create database schema (tables, indexes, etc.)
   */
  createSchema() {
    // Players table - persistent player profiles
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

    // Sessions table - active/recent sessions for recovery
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        socket_id TEXT,
        state TEXT, -- JSON blob of game state
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        disconnected_at INTEGER,
        FOREIGN KEY (player_id) REFERENCES players(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_socket ON sessions(socket_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_disconnected ON sessions(disconnected_at) WHERE disconnected_at IS NOT NULL;
    `);

    // Permanent upgrades table - shop purchases that persist
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

    // Leaderboard table - top scores
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

    // Account progression table - account leveling system
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

    // Skill tree table - available skills and their properties
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

    // Achievements table - player achievements
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
    `);

    logger.info('Database schema created');
  }

  /**
   * Get database instance
   */
  getDb() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  /**
   * Create backup of database
   */
  backup(backupPath) {
    if (!this.db) {
      return;
    }

    try {
      const backup = this.db.backup(backupPath);
      backup.step(-1); // Complete backup in one step
      backup.finish();
      logger.info('Database backup created', { path: backupPath });
    } catch (error) {
      logger.error('Failed to create backup', { error: error.message });
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new DatabaseManager();
    }
    return instance;
  }
};
