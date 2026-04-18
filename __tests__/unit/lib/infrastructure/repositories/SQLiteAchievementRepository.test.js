'use strict';

const Database = require('better-sqlite3');
const SQLiteAchievementRepository = require('../../../../../lib/infrastructure/repositories/SQLiteAchievementRepository');
const Achievement = require('../../../../../lib/domain/entities/Achievement');

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
    CREATE TABLE achievements (
      achievement_id TEXT PRIMARY KEY,
      achievement_name TEXT NOT NULL,
      achievement_description TEXT,
      category TEXT NOT NULL,
      tier TEXT DEFAULT 'bronze',
      unlock_criteria_json TEXT NOT NULL,
      reward_type TEXT,
      reward_value INTEGER DEFAULT 0,
      icon_emoji TEXT,
      is_secret INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE player_achievements (
      player_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at INTEGER DEFAULT (strftime('%s', 'now')),
      progress_current INTEGER DEFAULT 0,
      progress_required INTEGER NOT NULL,
      PRIMARY KEY (player_id, achievement_id),
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id)
    );
  `);
  db.prepare("INSERT INTO players (id, username) VALUES ('p1', 'Alice')").run();
  db.prepare(`
    INSERT INTO achievements (achievement_id, achievement_name, category, tier, unlock_criteria_json, reward_type, reward_value, icon_emoji)
    VALUES ('first_blood', 'First Blood', 'combat', 'bronze', '{"zombiesKilled":1}', 'points', 10, 'B')
  `).run();
  db.prepare(`
    INSERT INTO achievements (achievement_id, achievement_name, category, tier, unlock_criteria_json, reward_type, reward_value, icon_emoji)
    VALUES ('survivor', 'Survivor', 'survival', 'silver', '{"highestWave":5}', 'points', 15, 'S')
  `).run();
  return db;
}

describe('SQLiteAchievementRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = buildDB();
    repo = new SQLiteAchievementRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('getAllAchievements_seedData_returnsAchievementInstances', async () => {
    const results = await repo.getAllAchievements();
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]).toBeInstanceOf(Achievement);
  });

  test('getAchievementById_existingId_returnsAchievement', async () => {
    const result = await repo.getAchievementById('first_blood');
    expect(result).not.toBeNull();
    expect(result.name).toBe('First Blood');
  });

  test('getAchievementById_unknownId_returnsNull', async () => {
    const result = await repo.getAchievementById('nonexistent');
    expect(result).toBeNull();
  });

  test('unlockAchievement_newUnlock_returnsTrueAndPersists', async () => {
    const unlocked = await repo.unlockAchievement('p1', 'first_blood', 1);
    expect(unlocked).toBe(true);
  });

  test('unlockAchievement_duplicate_returnsFalse', async () => {
    await repo.unlockAchievement('p1', 'first_blood', 1);
    const second = await repo.unlockAchievement('p1', 'first_blood', 1);
    expect(second).toBe(false);
  });

  test('getPlayerAchievements_afterUnlock_returnsEntries', async () => {
    await repo.unlockAchievement('p1', 'first_blood', 1);
    const results = await repo.getPlayerAchievements('p1');
    expect(results).toHaveLength(1);
    expect(results[0].achievementId).toBe('first_blood');
  });

  test('getPlayerAchievements_unknownPlayer_returnsEmptyArray', async () => {
    const results = await repo.getPlayerAchievements('ghost');
    expect(results).toHaveLength(0);
  });

  test('hasAchievement_afterUnlock_returnsTrue', async () => {
    await repo.unlockAchievement('p1', 'first_blood', 1);
    const has = await repo.hasAchievement('p1', 'first_blood');
    expect(has).toBe(true);
  });

  test('hasAchievement_notYetUnlocked_returnsFalse', async () => {
    const has = await repo.hasAchievement('p1', 'first_blood');
    expect(has).toBe(false);
  });

  test('updateProgress_existingEntry_updatesValue', async () => {
    await repo.unlockAchievement('p1', 'first_blood', 10);
    await repo.updateProgress('p1', 'first_blood', 7);
    const results = await repo.getPlayerAchievements('p1');
    expect(results[0].progressCurrent).toBe(7);
  });

  test('batchUnlockAchievements_twoAchievements_returnsInsertedCount', () => {
    const count = repo.batchUnlockAchievements('p1', [
      { id: 'first_blood', progressRequired: 1 },
      { id: 'survivor', progressRequired: 1 }
    ]);
    expect(count).toBe(2);
  });

  test('batchUnlockAchievements_emptyArray_returnsZero', () => {
    const count = repo.batchUnlockAchievements('p1', []);
    expect(count).toBe(0);
  });

  test('batchUnlockAchievements_duplicates_skipsExisting', () => {
    repo.batchUnlockAchievements('p1', [{ id: 'first_blood' }]);
    const count = repo.batchUnlockAchievements('p1', [{ id: 'first_blood' }]);
    expect(count).toBe(0);
  });
});
