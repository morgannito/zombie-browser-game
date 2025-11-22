/**
 * DATABASE MANAGER
 * Main database connection and initialization manager
 * Uses better-sqlite3 for synchronous, high-performance SQLite operations
 * @version 1.0.0
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/infrastructure/Logger');

class DatabaseManager {
  /**
   * @param {string} dbPath - Path to SQLite database file
   * @param {Object} options - Database options
   */
  constructor(dbPath = './data/game.db', options = {}) {
    this.dbPath = dbPath;
    this.options = {
      verbose: options.verbose || null,
      fileMustExist: options.fileMustExist || false,
      timeout: options.timeout || 5000,
      readonly: options.readonly || false
    };
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection
   * @returns {Database} Database instance
   */
  connect() {
    if (this.db) {
      return this.db;
    }

    // Ensure data directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create database connection
    this.db = new Database(this.dbPath, this.options);

    // Apply performance optimizations
    this._applyPragmas();

    // Set up hooks for debugging/logging
    if (this.options.verbose) {
      this.db.on('profile', (sql, time) => {
        logger.debug('Query execution time', { time: `${time}ms`, sql });
      });
    }

    logger.info('Database connected', { path: this.dbPath });
    return this.db;
  }

  /**
   * Apply SQLite PRAGMA settings for optimal performance
   * @private
   */
  _applyPragmas() {
    // WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Faster synchronization (safe for server crashes, but not OS crashes)
    this.db.pragma('synchronous = NORMAL');

    // Increase cache size (10MB)
    this.db.pragma('cache_size = -10000');

    // Store temporary tables in memory
    this.db.pragma('temp_store = MEMORY');

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');

    // Automatic index creation
    this.db.pragma('automatic_index = ON');

    // Set busy timeout to 5 seconds
    this.db.pragma(`busy_timeout = ${this.options.timeout}`);
  }

  /**
   * Initialize database schema
   * @param {boolean} forceMigration - Force re-run migrations
   * @returns {boolean} Success status
   */
  initializeSchema(forceMigration = false) {
    if (this.isInitialized && !forceMigration) {
      return true;
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    try {
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Execute schema in a transaction
      const transaction = this.db.transaction(() => {
        // Split by semicolon and execute each statement
        const statements = schema
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          try {
            this.db.exec(statement);
          } catch (error) {
            // Ignore "already exists" errors
            if (!error.message.includes('already exists')) {
              throw error;
            }
          }
        }
      });

      transaction();

      this.isInitialized = true;
      logger.info('Database schema initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize schema', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Seed database with initial data
   * @param {boolean} forceReseed - Force re-seed even if data exists
   * @returns {boolean} Success status
   */
  seedDatabase(forceReseed = false) {
    const seedPath = path.join(__dirname, 'seed.sql');
    if (!fs.existsSync(seedPath)) {
      logger.warn('Seed file not found, skipping seeding');
      return false;
    }

    try {
      // Check if already seeded
      const achievementCount = this.db.prepare('SELECT COUNT(*) as count FROM achievements').get();
      if (achievementCount.count > 0 && !forceReseed) {
        logger.info('Database already seeded, skipping');
        return true;
      }

      const seedSql = fs.readFileSync(seedPath, 'utf8');

      const transaction = this.db.transaction(() => {
        this.db.exec(seedSql);
      });

      transaction();

      logger.info('Database seeded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to seed database', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Run migrations
   * @returns {number} Number of migrations applied
   */
  runMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.info('No migrations directory found');
      return 0;
    }

    // Ensure migrations table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Get applied migrations
    const appliedMigrations = this.db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map(row => row.version);

    // Get available migration files
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of migrationFiles) {
      const version = parseInt(file.split('_')[0]);
      if (appliedMigrations.includes(version)) {
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const migration = fs.readFileSync(migrationPath, 'utf8');

      try {
        const transaction = this.db.transaction(() => {
          this.db.exec(migration);
          this.db
            .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
            .run(version, file);
        });

        transaction();
        appliedCount++;
        logger.info('Migration applied', { file });
      } catch (error) {
        logger.error('Failed to apply migration', { file, error: error.message, stack: error.stack });
        throw error;
      }
    }

    return appliedCount;
  }

  /**
   * Backup database
   * @param {string} backupPath - Path to backup file
   * @returns {boolean} Success status
   */
  backup(backupPath) {
    try {
      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Use better-sqlite3's backup method for safe backup
      this.db.backup(backupPath);

      logger.info('Database backed up', { path: backupPath });
      return true;
    } catch (error) {
      logger.error('Backup failed', { error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Vacuum database to reclaim space
   * @returns {boolean} Success status
   */
  vacuum() {
    try {
      this.db.exec('VACUUM');
      logger.info('Database vacuumed successfully');
      return true;
    } catch (error) {
      logger.error('Vacuum failed', { error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Analyze database to update statistics
   * @returns {boolean} Success status
   */
  analyze() {
    try {
      this.db.exec('ANALYZE');
      logger.info('Database analyzed successfully');
      return true;
    } catch (error) {
      logger.error('Analyze failed', { error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Get database statistics
   * @returns {Object} Database stats
   */
  getStats() {
    try {
      const pageCount = this.db.pragma('page_count', { simple: true });
      const pageSize = this.db.pragma('page_size', { simple: true });
      const freelistCount = this.db.pragma('freelist_count', { simple: true });

      const sizeBytes = pageCount * pageSize;
      const freeSizeBytes = freelistCount * pageSize;

      return {
        sizeBytes,
        sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
        freeBytes: freeSizeBytes,
        freeMB: (freeSizeBytes / 1024 / 1024).toFixed(2),
        pageCount,
        pageSize,
        freelistCount,
        walMode: this.db.pragma('journal_mode', { simple: true })
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error: error.message, stack: error.stack });
      return null;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Get raw database instance
   * @returns {Database} Database instance
   */
  getDatabase() {
    if (!this.db) {
      this.connect();
    }
    return this.db;
  }
}

module.exports = DatabaseManager;