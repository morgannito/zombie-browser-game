/**
 * MIGRATION RUNNER - SQLite migration engine with rollback support
 * Tracks applied migrations, checksums, and supports .down.sql rollbacks
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MigrationRunner {
  constructor(db, migrationsDir) {
    this.db = db;
    this.migrationsDir = migrationsDir || path.join(__dirname, 'migrations');
    this._ensureMigrationsTable();
  }

  _ensureMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT (datetime('now')),
        checksum TEXT
      )
    `);
  }

  _getAppliedMigrations() {
    return this.db
      .prepare('SELECT name FROM _migrations ORDER BY id')
      .all()
      .map(r => r.name);
  }

  _getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }
    return fs
      .readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('.down.'))
      .sort();
  }

  _checksum(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Run all pending migrations
   * @returns {{ applied: string[], skipped: string[] }}
   */
  up() {
    const applied = this._getAppliedMigrations();
    const files = this._getMigrationFiles();
    const result = { applied: [], skipped: [] };

    for (const file of files) {
      if (applied.includes(file)) {
        result.skipped.push(file);
        continue;
      }

      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = this._checksum(sql);

      try {
        this.db.exec('BEGIN');
        this.db.exec(sql);
        this.db
          .prepare('INSERT INTO _migrations (name, checksum) VALUES (?, ?)')
          .run(file, checksum);
        this.db.exec('COMMIT');
        result.applied.push(file);
        console.log(`[Migration] Applied: ${file}`);
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Rollback the last N migrations
   * @param {number} count - Number of migrations to rollback (default 1)
   * @returns {{ rolledBack: string[] }}
   */
  down(count = 1) {
    const applied = this._getAppliedMigrations().reverse();
    const result = { rolledBack: [] };

    for (let i = 0; i < Math.min(count, applied.length); i++) {
      const name = applied[i];
      const downFile = name.replace('.sql', '.down.sql');
      const downPath = path.join(this.migrationsDir, downFile);

      if (!fs.existsSync(downPath)) {
        console.warn(`[Migration] No rollback file for ${name} (expected ${downFile})`);
        continue;
      }

      const sql = fs.readFileSync(downPath, 'utf8');

      try {
        this.db.exec('BEGIN');
        this.db.exec(sql);
        this.db.prepare('DELETE FROM _migrations WHERE name = ?').run(name);
        this.db.exec('COMMIT');
        result.rolledBack.push(name);
        console.log(`[Migration] Rolled back: ${name}`);
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw new Error(`Rollback ${name} failed: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Get migration status
   * @returns {{ applied: number, pending: number, total: number, migrations: Array }}
   */
  status() {
    const applied = this._getAppliedMigrations();
    const files = this._getMigrationFiles();

    return {
      applied: applied.length,
      pending: files.filter(f => !applied.includes(f)).length,
      total: files.length,
      migrations: files.map(f => ({
        name: f,
        status: applied.includes(f) ? 'applied' : 'pending',
        hasRollback: fs.existsSync(path.join(this.migrationsDir, f.replace('.sql', '.down.sql')))
      }))
    };
  }
}

module.exports = MigrationRunner;
