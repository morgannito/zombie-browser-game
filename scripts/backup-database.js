#!/usr/bin/env node
/**
 * DATABASE BACKUP SCRIPT
 * Automatically backs up the game database with rotation
 * Usage: node scripts/backup-database.js
 */

const path = require('path');
const fs = require('fs');
const DatabaseManager = require('../database/DatabaseManager');
const logger = require('../lib/infrastructure/Logger');

// Configuration
const DB_PATH = process.env.DB_PATH || './data/game.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 7; // Keep 7 days of backups

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('Backup directory created', { path: BACKUP_DIR });
  }
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `game-db-backup-${timestamp}.db`;
}

/**
 * Perform database backup
 */
function performBackup() {
  try {
    ensureBackupDir();

    const backupFilename = getBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    logger.info('Starting database backup', { source: DB_PATH, destination: backupPath });

    // Initialize database manager
    const dbManager = new DatabaseManager(DB_PATH);
    dbManager.connect();

    // Perform backup
    const success = dbManager.backup(backupPath);

    // Close connection
    dbManager.close();

    if (success) {
      logger.info('Database backup completed successfully', { backupPath });

      // Get backup file size
      const stats = fs.statSync(backupPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      logger.info('Backup file size', { size: `${sizeMB} MB` });

      return backupPath;
    } else {
      logger.error('Database backup failed');
      return null;
    }
  } catch (error) {
    logger.error('Backup error', { error: error.message, stack: error.stack });
    return null;
  }
}

/**
 * Rotate old backups (keep only MAX_BACKUPS most recent)
 */
function rotateBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }

    // Get all backup files sorted by modification time (newest first)
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('game-db-backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    logger.info('Found existing backups', { count: backupFiles.length });

    // Delete old backups beyond MAX_BACKUPS
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);

      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        logger.info('Deleted old backup', { file: file.name });
      });

      logger.info('Backup rotation completed', { deleted: filesToDelete.length, kept: MAX_BACKUPS });
    } else {
      logger.info('No backups to rotate', { current: backupFiles.length, max: MAX_BACKUPS });
    }
  } catch (error) {
    logger.error('Backup rotation error', { error: error.message, stack: error.stack });
  }
}

/**
 * Main backup process
 */
function main() {
  logger.info('===== DATABASE BACKUP STARTED =====');
  logger.info('Configuration', {
    dbPath: DB_PATH,
    backupDir: BACKUP_DIR,
    maxBackups: MAX_BACKUPS
  });

  // Perform backup
  const backupPath = performBackup();

  if (backupPath) {
    // Rotate old backups
    rotateBackups();

    logger.info('===== DATABASE BACKUP COMPLETED =====');
    process.exit(0);
  } else {
    logger.error('===== DATABASE BACKUP FAILED =====');
    process.exit(1);
  }
}

// Run backup if executed directly
if (require.main === module) {
  main();
}

module.exports = { performBackup, rotateBackups };
