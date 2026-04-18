# Database Migrations

## Overview

The migration system uses `database/MigrationRunner.js` with SQLite (better-sqlite3). Migrations are plain SQL files in `database/migrations/`, tracked in a `_migrations` table with MD5 checksums to detect tampering.

**Stack**: better-sqlite3 · WAL mode · synchronous transactions

---

## Infrastructure

### DatabaseManager (`infrastructure/database/DatabaseManager.js`)

Singleton. Manages the SQLite connection at `data/game.db` (override via `DB_PATH` env var).

Key PRAGMAs applied on `initialize()`:

| PRAGMA | Value | Purpose |
|---|---|---|
| `journal_mode` | WAL | Concurrent reads during writes |
| `synchronous` | NORMAL | Balanced durability/speed |
| `busy_timeout` | 5000ms | Retry on locked DB |
| `cache_size` | -64000 (64 MB) | In-memory page cache |
| `mmap_size` | 128 MB | Memory-mapped I/O |
| `wal_autocheckpoint` | 1000 pages | Prevent unbounded WAL growth |

`createSchema()` is called on init and creates all tables idempotently (`CREATE TABLE IF NOT EXISTS`). This is the baseline; migrations extend beyond it.

### MigrationRunner (`database/MigrationRunner.js`)

```js
const runner = new MigrationRunner(db, migrationsDir);
runner.up();        // apply pending
runner.down(n);     // rollback last n
runner.status();    // inspect state
```

**Tracking table** (`_migrations`):

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  applied_at  TEXT DEFAULT (datetime('now')),
  checksum    TEXT
);
```

---

## Checksum Verification

Every `.sql` file is hashed with MD5 before application. The hash is stored in `_migrations.checksum`.

On each `up()` run, already-applied migrations are re-hashed and compared. A mismatch throws:

```
Checksum mismatch for already-applied migration <file> — file was modified after application
```

**Rule**: never edit a migration file after it has been applied to any environment.

---

## Rollback Strategy

Each migration has a paired `.down.sql` file. Rollbacks execute in reverse chronological order.

`runner.down(n)` rolls back the last `n` applied migrations. Missing `.down.sql` aborts the entire rollback with an error before any SQL runs.

Both `up` and `down` wrap execution in a `db.transaction()` — the migration SQL and the `_migrations` table update are atomic. A partial failure leaves the database unchanged.

---

## Migration Files

Located in `database/migrations/`. Naming convention: `NNN_description[.down].sql`.

| # | File | Description |
|---|---|---|
| 001 | `001_initial_schema.sql` | Core runtime tables: `players`, `sessions`, `permanent_upgrades`, `leaderboard` |
| 002 | `002_account_progression.sql` | Account progression, skill tree, achievements, player_achievements |
| 003 | `003_achievements_data.sql` | Seed data: achievement definitions |
| 004 | `004_performance_indexes.sql` | Composite indexes for leaderboard and progression queries |
| 005 | `005_daily_challenges.sql` | `daily_challenges` and `player_daily_challenges` tables |

Each has a corresponding `.down.sql` rollback file.

---

## Usage

### Apply all pending migrations

```bash
# Via MigrationRunner (programmatic)
const runner = new MigrationRunner(db);
runner.up();

# Via legacy script (single file, no tracking)
node scripts/apply-migration.js database/migrations/005_daily_challenges.sql
```

The legacy `scripts/apply-migration.js` executes SQL directly without tracking. Use `MigrationRunner` for production.

### Check status

```js
const { applied, pending, total, migrations } = runner.status();
// migrations[i] = { name, status: 'applied'|'pending', hasRollback: bool }
```

### Rollback

```js
runner.down(1);   // last migration
runner.down(3);   // last 3 migrations
```

---

## Adding a Migration

1. Create `database/migrations/NNN_description.sql` — number sequentially.
2. Create `database/migrations/NNN_description.down.sql` — must fully reverse the up migration.
3. Never modify an already-applied migration file; create a new one instead.
4. Test rollback locally before deploying.

---

## Online Backup

`DatabaseManager.backup(destPath)` uses better-sqlite3's async page-by-page API. WAL readers are not blocked during backup. See `docs/BACKUP.md` for scheduling details.
