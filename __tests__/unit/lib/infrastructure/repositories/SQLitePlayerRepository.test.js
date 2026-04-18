'use strict';

const Database = require('better-sqlite3');
const SQLitePlayerRepository = require('../../../../../lib/infrastructure/repositories/SQLitePlayerRepository');
const { ValidationError, NotFoundError } = require('../../../../../lib/domain/errors/DomainErrors');
const Player = require('../../../../../lib/domain/entities/Player');

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
    )
  `);
  return db;
}

function makePlayer(overrides = {}) {
  return new Player({
    id: 'player-1',
    username: 'TestUser',
    totalKills: 10,
    totalDeaths: 2,
    highestWave: 5,
    highestLevel: 8,
    totalPlaytime: 3600000,
    totalGoldEarned: 500,
    lastSeen: Date.now(),
    ...overrides
  });
}

describe('SQLitePlayerRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = buildDB();
    repo = new SQLitePlayerRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('create_validPlayer_persistsAndReturnsPlayer', async () => {
    const player = makePlayer();
    const result = await repo.create(player);
    expect(result.id).toBe('player-1');
  });

  test('create_missingId_throwsValidationError', async () => {
    await expect(repo.create({ username: 'x' })).rejects.toBeInstanceOf(ValidationError);
  });

  test('create_missingUsername_throwsValidationError', async () => {
    await expect(repo.create({ id: 'abc' })).rejects.toBeInstanceOf(ValidationError);
  });

  test('create_duplicateId_throwsValidationError', async () => {
    const player = makePlayer();
    await repo.create(player);
    await expect(repo.create(makePlayer({ username: 'Other' }))).rejects.toBeInstanceOf(ValidationError);
  });

  test('create_duplicateUsername_throwsValidationError', async () => {
    await repo.create(makePlayer());
    await expect(repo.create(makePlayer({ id: 'player-2' }))).rejects.toBeInstanceOf(ValidationError);
  });

  test('findById_existingPlayer_returnsPlayer', async () => {
    await repo.create(makePlayer());
    const result = await repo.findById('player-1');
    expect(result.username).toBe('TestUser');
  });

  test('findById_unknownPlayer_returnsNull', async () => {
    const result = await repo.findById('ghost');
    expect(result).toBeNull();
  });

  test('findById_emptyId_throwsValidationError', async () => {
    await expect(repo.findById('')).rejects.toBeInstanceOf(ValidationError);
  });

  test('findByUsername_existingUsername_returnsPlayer', async () => {
    await repo.create(makePlayer());
    const result = await repo.findByUsername('TestUser');
    expect(result.id).toBe('player-1');
  });

  test('findByUsername_unknownUsername_returnsNull', async () => {
    const result = await repo.findByUsername('Ghost');
    expect(result).toBeNull();
  });

  test('findByUsername_emptyString_throwsValidationError', async () => {
    await expect(repo.findByUsername('')).rejects.toBeInstanceOf(ValidationError);
  });

  test('update_existingPlayer_updatesStats', async () => {
    const player = makePlayer();
    await repo.create(player);
    player.totalKills = 999;
    player.lastSeen = Date.now();
    await repo.update(player);
    const updated = await repo.findById('player-1');
    expect(updated.totalKills).toBe(999);
  });

  test('update_nonExistentPlayer_throwsNotFoundError', async () => {
    const ghost = makePlayer({ id: 'ghost', username: 'Ghost' });
    ghost.lastSeen = Date.now();
    await expect(repo.update(ghost)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('update_missingId_throwsValidationError', async () => {
    await expect(repo.update({ username: 'x' })).rejects.toBeInstanceOf(ValidationError);
  });

  test('getTopPlayers_multipleEntries_returnsOrderedByWave', async () => {
    await repo.create(makePlayer({ id: 'p1', username: 'A', highestWave: 3 }));
    await repo.create(makePlayer({ id: 'p2', username: 'B', highestWave: 10 }));
    const top = await repo.getTopPlayers(5);
    expect(top[0].highestWave).toBe(10);
  });

  test('getTopPlayers_emptyTable_returnsEmptyArray', async () => {
    const result = await repo.getTopPlayers(5);
    expect(result).toHaveLength(0);
  });

  test('getTopPlayers_limitExceeded_throwsValidationError', async () => {
    await expect(repo.getTopPlayers(200)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getStats_existingPlayer_returnsStatsObject', async () => {
    await repo.create(makePlayer({ totalKills: 10, totalDeaths: 5 }));
    const stats = await repo.getStats('player-1');
    expect(stats.totalKills).toBe(10);
  });

  test('getStats_unknownPlayer_throwsNotFoundError', async () => {
    await expect(repo.getStats('unknown')).rejects.toBeInstanceOf(NotFoundError);
  });
});
