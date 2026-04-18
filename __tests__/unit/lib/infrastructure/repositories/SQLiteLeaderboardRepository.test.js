'use strict';

const Database = require('better-sqlite3');
const SQLiteLeaderboardRepository = require('../../../../../lib/infrastructure/repositories/SQLiteLeaderboardRepository');
const { ValidationError } = require('../../../../../lib/domain/errors/DomainErrors');

function buildDB() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_seen INTEGER DEFAULT (strftime('%s', 'now')),
      total_kills INTEGER DEFAULT 0,
      total_deaths INTEGER DEFAULT 0,
      highest_wave INTEGER DEFAULT 0,
      highest_level INTEGER DEFAULT 0,
      total_playtime INTEGER DEFAULT 0,
      total_gold_earned INTEGER DEFAULT 0
    );
    CREATE TABLE leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      wave INTEGER NOT NULL,
      level INTEGER NOT NULL,
      kills INTEGER NOT NULL,
      survival_time INTEGER NOT NULL,
      score INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
  `);
  db.prepare("INSERT INTO players (id, username) VALUES ('p1', 'Alice')").run();
  db.prepare("INSERT INTO players (id, username) VALUES ('p2', 'Bob')").run();
  return db;
}

function makeEntry(overrides = {}) {
  return {
    playerId: 'p1',
    wave: 5,
    level: 10,
    kills: 50,
    survivalTime: 300,
    score: 1000,
    ...overrides
  };
}

describe('SQLiteLeaderboardRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = buildDB();
    repo = new SQLiteLeaderboardRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('submit_validEntry_persistsAndAssignsId', async () => {
    const entry = makeEntry();
    const result = await repo.submit(entry);
    expect(result.id).toBeDefined();
  });

  test('submit_missingPlayerId_throwsValidationError', async () => {
    await expect(repo.submit({ wave: 1, score: 10 })).rejects.toBeInstanceOf(ValidationError);
  });

  test('submit_negativeWave_throwsValidationError', async () => {
    await expect(repo.submit(makeEntry({ wave: -1 }))).rejects.toBeInstanceOf(ValidationError);
  });

  test('submit_negativeScore_throwsValidationError', async () => {
    await expect(repo.submit(makeEntry({ score: -5 }))).rejects.toBeInstanceOf(ValidationError);
  });

  test('getTop_returnsOrderedByScore', async () => {
    await repo.submit(makeEntry({ score: 500 }));
    await repo.submit(makeEntry({ score: 2000 }));
    const top = await repo.getTop(10);
    expect(top[0].score).toBe(2000);
  });

  test('getTop_emptyTable_returnsEmptyArray', async () => {
    const result = await repo.getTop(5);
    expect(result).toHaveLength(0);
  });

  test('getTop_limitZero_throwsValidationError', async () => {
    await expect(repo.getTop(0)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getTop_limitOver100_throwsValidationError', async () => {
    await expect(repo.getTop(101)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getByPlayer_returnsOnlyPlayerEntries', async () => {
    await repo.submit(makeEntry({ playerId: 'p1', score: 100 }));
    await repo.submit(makeEntry({ playerId: 'p2', score: 200 }));
    const results = await repo.getByPlayer('p1', 10);
    expect(results).toHaveLength(1);
    expect(results[0].playerId).toBe('p1');
  });

  test('getByPlayer_unknownPlayer_returnsEmptyArray', async () => {
    const result = await repo.getByPlayer('ghost', 10);
    expect(result).toHaveLength(0);
  });

  test('getByPlayer_missingPlayerId_throwsValidationError', async () => {
    await expect(repo.getByPlayer('', 10)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getBestForPlayer_returnsHighestScore', async () => {
    await repo.submit(makeEntry({ score: 100 }));
    await repo.submit(makeEntry({ score: 999 }));
    const best = await repo.getBestForPlayer('p1');
    expect(best.score).toBe(999);
  });

  test('getBestForPlayer_noEntries_returnsNull', async () => {
    const result = await repo.getBestForPlayer('p1');
    expect(result).toBeNull();
  });

  test('getBestForPlayer_missingPlayerId_throwsValidationError', async () => {
    await expect(repo.getBestForPlayer('')).rejects.toBeInstanceOf(ValidationError);
  });

  test('getPlayerRank_singleEntry_ranksFirst', async () => {
    await repo.submit(makeEntry({ score: 500 }));
    const rank = await repo.getPlayerRank('p1');
    expect(rank).toBe(1);
  });

  test('getPlayerRank_betterCompetitor_ranksBehind', async () => {
    await repo.submit(makeEntry({ playerId: 'p2', score: 9999 }));
    await repo.submit(makeEntry({ playerId: 'p1', score: 100 }));
    const rank = await repo.getPlayerRank('p1');
    expect(rank).toBeGreaterThan(1);
  });

  test('cleanup_keepCountValid_removesExcess', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.submit(makeEntry({ score: i * 10 }));
    }
    const deleted = await repo.cleanup(100);
    expect(typeof deleted).toBe('number');
  });

  test('cleanup_keepCountBelow100_throwsValidationError', async () => {
    await expect(repo.cleanup(50)).rejects.toBeInstanceOf(ValidationError);
  });
});
