const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const MigrationRunner = require('../../../database/MigrationRunner');

describe('MigrationRunner integration', () => {
  let db;
  let dbPath;
  let runner;

  const migrationsDir = path.join(__dirname, '../../../database/migrations');

  const removeDbArtifacts = filePath => {
    for (const suffix of ['', '-wal', '-shm']) {
      const candidate = `${filePath}${suffix}`;
      if (fs.existsSync(candidate)) {
        fs.unlinkSync(candidate);
      }
    }
  };

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `zombie-migration-${Date.now()}-${Math.random()}.db`);
    removeDbArtifacts(dbPath);

    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    runner = new MigrationRunner(db, migrationsDir);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    removeDbArtifacts(dbPath);
  });

  it('applies all migrations and seeds achievement data', () => {
    const result = runner.up();

    expect(result.applied).toEqual([
      '001_initial_schema.sql',
      '002_account_progression.sql',
      '003_achievements_data.sql',
      '004_performance_indexes.sql',
      '005_daily_challenges.sql'
    ]);

    const status = runner.status();
    expect(status.applied).toBe(5);
    expect(status.pending).toBe(0);

    const achievementCount = db.prepare('SELECT COUNT(*) as count FROM achievements').get().count;
    const skillCount = db.prepare('SELECT COUNT(*) as count FROM skill_tree').get().count;

    expect(achievementCount).toBe(25);
    expect(skillCount).toBeGreaterThan(0);
  });

  it('rolls back last migration and can reapply it', () => {
    runner.up();

    const rollback = runner.down(1);
    expect(rollback.rolledBack).toEqual(['005_daily_challenges.sql']);

    const reapply = runner.up();
    expect(reapply.applied).toEqual(['005_daily_challenges.sql']);

    const countAfterReapply = db.prepare('SELECT COUNT(*) as count FROM achievements').get().count;
    expect(countAfterReapply).toBe(25);
  });
});
