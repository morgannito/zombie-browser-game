/**
 * @fileoverview Database bootstrap — extracted from server.js setup block.
 * @description Provides DatabaseManager instance and a safe async initializer
 *   that honors the REQUIRE_DATABASE env flag (hard-exit vs degraded mode).
 */

const DatabaseManager = require('../infrastructure/database/DatabaseManager');
const logger = require('../infrastructure/logging/Logger');

const dbManager = DatabaseManager.getInstance();

/**
 * Initialize the database. Returns true on success, false if the server is
 * allowed to run in degraded mode. Hard-exits when REQUIRE_DATABASE=true.
 * @returns {Promise<boolean>} dbAvailable
 */
async function initializeDatabase() {
  // Bench / test harness bypass — don't touch sqlite when DB_SKIP=1.
  if (process.env.DB_SKIP === '1') {
    logger.warn('DB_SKIP=1 — running in no-db mode (bench/test only)');
    return false;
  }
  try {
    await Promise.resolve(dbManager.initialize());
    logger.info('✅ Database connected successfully');
    return true;
  } catch (err) {
    logger.error('❌ CRITICAL: Database initialization failed', {
      error: err.message,
      stack: err.stack
    });

    if (process.env.REQUIRE_DATABASE === 'true') {
      logger.error('❌ Database required but unavailable, shutting down');
      process.exit(1);
    }

    logger.warn('⚠️  Running without database - progression features disabled');
    return false;
  }
}

module.exports = { dbManager, initializeDatabase };
