/**
 * Apply database migration
 * Usage: node scripts/apply-migration.js <migration-file>
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const migrationFile = process.argv[2] || 'database/migrations/002_account_progression.sql';
const dbPath = 'database/zombie_game.db';

console.log(`📦 Applying migration: ${migrationFile}`);

try {
  // Read migration SQL
  const sql = fs.readFileSync(path.join(__dirname, '..', migrationFile), 'utf8');

  // Open database
  const db = new Database(dbPath);

  // Execute entire SQL at once (better-sqlite3 handles multiple statements)
  try {
    db.exec(sql);
    console.log('✓ Migration executed successfully');
  } catch (error) {
    // If it fails, check if objects already exist
    if (error.message.includes('already exists')) {
      console.log('⚠ Some objects already exist (this is OK)');
    } else {
      console.error('✗ Migration failed:', error.message);
      throw error;
    }
  }

  db.close();
  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
