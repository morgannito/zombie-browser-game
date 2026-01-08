#!/usr/bin/env node
/**
 * DATABASE INITIALIZATION SCRIPT
 * Run this to create and initialize the game database
 * Usage: node database/scripts/init-database.js
 */

const path = require('path');
const fs = require('fs');

// Ensure we're in the project root
const projectRoot = path.resolve(__dirname, '../..');
process.chdir(projectRoot);

const DatabaseManager = require('../DatabaseManager');

console.log('='.repeat(70));
console.log('ZOMBIE GAME - DATABASE INITIALIZATION');
console.log('='.repeat(70));
console.log();

// Configuration
const DB_PATH = './data/game.db';
const FORCE_RECREATE = process.argv.includes('--force');

// Check if database already exists
const dbExists = fs.existsSync(DB_PATH);

if (dbExists && !FORCE_RECREATE) {
  console.log(`⚠️  Database already exists at: ${DB_PATH}`);
  console.log('   Use --force to recreate (WARNING: This will delete all data!)');
  console.log();
  process.exit(0);
}

if (dbExists && FORCE_RECREATE) {
  console.log('⚠️  FORCE MODE: Deleting existing database...');
  fs.unlinkSync(DB_PATH);
  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
  }
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
  }
  console.log('✓ Old database deleted');
  console.log();
}

try {
  console.log('Step 1/4: Creating database connection...');
  const dbManager = new DatabaseManager(DB_PATH);
  dbManager.connect();
  console.log('✓ Database connection established');
  console.log();

  console.log('Step 2/4: Creating schema (tables, indexes, triggers)...');
  dbManager.initializeSchema();
  console.log('✓ Schema created successfully');
  console.log();

  console.log('Step 3/4: Seeding initial data (achievements, etc.)...');
  dbManager.seedDatabase();
  console.log('✓ Database seeded successfully');
  console.log();

  console.log('Step 4/4: Verifying database integrity...');
  const db = dbManager.getDatabase();

  // Check table counts
  const tables = [
    'players',
    'player_stats',
    'game_sessions',
    'leaderboards',
    'achievements',
    'permanent_upgrades'
  ];

  console.log('\nTable Verification:');
  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`  - ${table.padEnd(20)} ✓ (${result.count} rows)`);
  }

  // Get database stats
  const stats = dbManager.getStats();
  console.log('\nDatabase Statistics:');
  console.log(`  - Size: ${stats.sizeMB} MB`);
  console.log(`  - Page size: ${stats.pageSize} bytes`);
  console.log(`  - WAL mode: ${stats.walMode}`);
  console.log(`  - Location: ${path.resolve(DB_PATH)}`);

  // Test query
  const achievementCount = db.prepare('SELECT COUNT(*) as count FROM achievements').get();
  console.log(`\n✓ Verification complete: ${achievementCount.count} achievements loaded`);

  // Close connection
  dbManager.close();

  console.log();
  console.log('='.repeat(70));
  console.log('✓ DATABASE INITIALIZATION COMPLETE');
  console.log('='.repeat(70));
  console.log();
  console.log('Next steps:');
  console.log('  1. npm install better-sqlite3 uuid (if not already installed)');
  console.log('  2. Read: database/IMPLEMENTATION_GUIDE.md');
  console.log('  3. Integrate with server.js (see example_integration.js)');
  console.log('  4. Start server: npm start');
  console.log();

} catch (error) {
  console.error();
  console.error('❌ DATABASE INITIALIZATION FAILED');
  console.error('='.repeat(70));
  console.error();
  console.error('Error:', error.message);
  console.error();
  console.error('Stack trace:');
  console.error(error.stack);
  console.error();
  console.error('Troubleshooting:');
  console.error('  1. Ensure better-sqlite3 is installed: npm install better-sqlite3');
  console.error('  2. Check file permissions on ./data/ directory');
  console.error('  3. Verify schema.sql and seed.sql exist in database/');
  console.error('  4. Check for syntax errors in SQL files');
  console.error();
  process.exit(1);
}