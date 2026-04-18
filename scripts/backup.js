#!/usr/bin/env node
/**
 * DATABASE BACKUP CLI
 * Creates a timestamped backup of the SQLite database and prunes old backups.
 *
 * Usage:
 *   node scripts/backup.js [--dest <dir>] [--keep <N>]
 *
 * Options:
 *   --dest <dir>   Backup destination directory (default: ./data/backups)
 *   --keep <N>     Number of most-recent backups to retain (default: 7)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const DatabaseManager = require('../database/DatabaseManager');

// --- Parse CLI args ---
const args = process.argv.slice(2);

/**
 * Read a named CLI argument.
 * @param {string} flag
 * @param {string} fallback
 * @returns {string}
 */
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/game.db');
const destDir = getArg('--dest', path.join(__dirname, '../data/backups'));
const keep = parseInt(getArg('--keep', '7'), 10);

const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const backupName = `game_${ts}.db`;
const backupPath = path.join(destDir, backupName);

console.log('='.repeat(60));
console.log('ZOMBIE GAME - DATABASE BACKUP');
console.log('='.repeat(60));
console.log(`Source : ${path.resolve(dbPath)}`);
console.log(`Dest   : ${path.resolve(backupPath)}`);
console.log(`Keep   : ${keep} most-recent backups`);
console.log('');

/**
 * Remove oldest backups beyond the retention limit.
 * @param {string} dir - Backup directory
 * @param {number} limit - Max backups to keep
 */
function pruneOldBackups(dir, limit) {
  if (!fs.existsSync(dir)) {
return;
}

  const files = fs
    .readdirSync(dir)
    .filter(f => f.startsWith('game_') && f.endsWith('.db'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  for (const file of files.slice(limit)) {
    fs.unlinkSync(path.join(dir, file.name));
    console.log(`Pruned old backup: ${file.name}`);
  }
  console.log(`Retention: ${Math.min(files.length, limit)} backup(s) kept.`);
}

(async () => {
  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database not found at ${dbPath}`);
    process.exit(1);
  }

  // Ensure destination directory exists before attempting backup.
  fs.mkdirSync(destDir, { recursive: true });

  const manager = new DatabaseManager(dbPath);
  manager.connect();

  let ok = false;
  try {
    ok = await manager.backup(backupPath);
  } finally {
    manager.close();
  }

  if (!ok) {
    console.error('ERROR: Backup failed.');
    process.exit(1);
  }

  // Verify the backup file was actually written.
  if (!fs.existsSync(backupPath)) {
    console.error('ERROR: Backup reported success but file is missing.');
    process.exit(1);
  }

  console.log(`Backup created: ${backupName}`);
  pruneOldBackups(destDir, keep);
  console.log('');
  console.log('Done.');
})();
