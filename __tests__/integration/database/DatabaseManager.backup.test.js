const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const DatabaseManager = require('../../../database/DatabaseManager');

describe('DatabaseManager.backup', () => {
  let tmpDb;
  let tmpBackup;

  const removeFile = filePath => {
    for (const suffix of ['', '-wal', '-shm']) {
      const candidate = `${filePath}${suffix}`;
      if (fs.existsSync(candidate)) {
        fs.unlinkSync(candidate);
      }
    }
  };

  beforeEach(() => {
    tmpDb = path.join(os.tmpdir(), `zombie-mgr-${Date.now()}.db`);
    tmpBackup = path.join(os.tmpdir(), `zombie-backup-${Date.now()}.db`);
    removeFile(tmpDb);
    removeFile(tmpBackup);
  });

  afterEach(() => {
    removeFile(tmpDb);
    removeFile(tmpBackup);
  });

  it('creates a backup file and returns true', async () => {
    const manager = new DatabaseManager(tmpDb);
    manager.connect();

    manager.getDatabase().exec('CREATE TABLE t (x INTEGER)');
    manager.getDatabase().prepare('INSERT INTO t VALUES (42)').run();

    const result = await manager.backup(tmpBackup);

    expect(result).toBe(true);
    expect(fs.existsSync(tmpBackup)).toBe(true);

    const backupDb = new Database(tmpBackup, { readonly: true });
    const row = backupDb.prepare('SELECT x FROM t').get();
    backupDb.close();
    expect(row.x).toBe(42);

    manager.close();
  });

  it('creates backup destination directory if it does not exist', async () => {
    const nestedDir = path.join(os.tmpdir(), `zombie-backup-dir-${Date.now()}`, 'sub');
    const nestedPath = path.join(nestedDir, 'game.db');

    const manager = new DatabaseManager(tmpDb);
    manager.connect();

    const result = await manager.backup(nestedPath);
    expect(result).toBe(true);
    expect(fs.existsSync(nestedPath)).toBe(true);

    manager.close();
    fs.rmSync(path.dirname(nestedDir), { recursive: true, force: true });
  });

  it('returns false when backup fails (bad path)', async () => {
    const manager = new DatabaseManager(tmpDb);
    manager.connect();

    const badPath = os.tmpdir();
    const result = await manager.backup(badPath);
    expect(result).toBe(false);

    manager.close();
  });
});
