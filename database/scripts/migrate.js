#!/usr/bin/env node
/**
 * MIGRATION CLI - Run, rollback, and inspect database migrations
 * Usage:
 *   node database/scripts/migrate.js up        -- Apply all pending migrations
 *   node database/scripts/migrate.js down [N]   -- Rollback last N migrations (default 1)
 *   node database/scripts/migrate.js status     -- Show migration status
 */

const Database = require('better-sqlite3');
const MigrationRunner = require('../MigrationRunner');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/game.db');
const command = process.argv[2] || 'up';
const count = parseInt(process.argv[3]) || 1;

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for safety
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const runner = new MigrationRunner(db, path.join(__dirname, '..', 'migrations'));

console.log('='.repeat(60));
console.log('ZOMBIE GAME - MIGRATION RUNNER');
console.log('='.repeat(60));
console.log(`Database: ${path.resolve(dbPath)}`);
console.log(`Command:  ${command}`);
console.log('');

try {
  switch (command) {
    case 'up': {
      const result = runner.up();
      console.log('');
      console.log(`Applied: ${result.applied.length} migration(s)`);
      console.log(`Skipped: ${result.skipped.length} (already applied)`);
      break;
    }
    case 'down': {
      const result = runner.down(count);
      console.log('');
      console.log(`Rolled back: ${result.rolledBack.length} migration(s)`);
      break;
    }
    case 'status': {
      const status = runner.status();
      console.log(`Total:   ${status.total}`);
      console.log(`Applied: ${status.applied}`);
      console.log(`Pending: ${status.pending}`);
      console.log('');
      for (const m of status.migrations) {
        const mark = m.status === 'applied' ? '[x]' : '[ ]';
        const rollback = m.hasRollback ? '(rollback available)' : '(no rollback)';
        console.log(`  ${mark} ${m.name} ${rollback}`);
      }
      break;
    }
    default:
      console.log('Usage: node migrate.js [up|down|status] [count]');
      console.log('');
      console.log('Commands:');
      console.log('  up       Apply all pending migrations');
      console.log('  down N   Rollback last N migrations (default 1)');
      console.log('  status   Show migration status');
  }
} catch (err) {
  console.error('');
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
} finally {
  db.close();
}

console.log('');
console.log('Done.');
