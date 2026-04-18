'use strict';

const Database = require('better-sqlite3');
const SQLiteProgressionRepository = require('../../../../../lib/infrastructure/repositories/SQLiteProgressionRepository');
const { ValidationError, NotFoundError } = require('../../../../../lib/domain/errors/DomainErrors');
const AccountProgression = require('../../../../../lib/domain/entities/AccountProgression');

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
    CREATE TABLE account_progression (
      player_id TEXT PRIMARY KEY,
      account_level INTEGER DEFAULT 1,
      account_xp INTEGER DEFAULT 0,
      total_xp_earned INTEGER DEFAULT 0,
      skill_points INTEGER DEFAULT 0,
      prestige_level INTEGER DEFAULT 0,
      prestige_tokens INTEGER DEFAULT 0,
      unlocked_skills TEXT DEFAULT '[]',
      last_updated INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
    CREATE TABLE skill_tree (
      skill_id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      skill_description TEXT,
      skill_category TEXT NOT NULL,
      tier INTEGER NOT NULL,
      skill_cost INTEGER NOT NULL,
      max_rank INTEGER DEFAULT 1,
      icon_emoji TEXT,
      prerequisite_skills TEXT DEFAULT '[]',
      effects_json TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
  `);
  db.prepare("INSERT INTO players (id, username) VALUES ('p1', 'Alice')").run();
  db.prepare("INSERT INTO players (id, username) VALUES ('p2', 'Bob')").run();
  db.prepare(`
    INSERT INTO skill_tree VALUES ('dmg1','Damage I','Desc','damage',1,1,5,'E','[]','{"dmg":0.1}',1)
  `).run();
  db.prepare(`
    INSERT INTO skill_tree VALUES ('spd1','Speed I','Desc','utility',1,1,5,'E','[]','{"spd":0.1}',2)
  `).run();
  return db;
}

function makeProgression(overrides = {}) {
  return new AccountProgression({
    playerId: 'p1',
    accountLevel: 1,
    accountXP: 0,
    totalXPEarned: 0,
    skillPoints: 3,
    prestigeLevel: 0,
    prestigeTokens: 0,
    unlockedSkills: [],
    lastUpdated: Date.now(),
    ...overrides
  });
}

describe('SQLiteProgressionRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = buildDB();
    repo = new SQLiteProgressionRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('create_validProgression_persistsAndReturns', async () => {
    const prog = makeProgression();
    const result = await repo.create(prog);
    expect(result.playerId).toBe('p1');
  });

  test('create_missingPlayerId_throwsValidationError', async () => {
    await expect(repo.create({})).rejects.toBeInstanceOf(ValidationError);
  });

  test('findByPlayerId_existingPlayer_returnsProgression', async () => {
    await repo.create(makeProgression());
    const result = await repo.findByPlayerId('p1');
    expect(result).not.toBeNull();
    expect(result.playerId).toBe('p1');
  });

  test('findByPlayerId_unknownPlayer_returnsNull', async () => {
    const result = await repo.findByPlayerId('ghost');
    expect(result).toBeNull();
  });

  test('findByPlayerId_emptyId_throwsValidationError', async () => {
    await expect(repo.findByPlayerId('')).rejects.toBeInstanceOf(ValidationError);
  });

  test('update_existingProgression_updatesSkillPoints', async () => {
    const prog = makeProgression();
    await repo.create(prog);
    prog.skillPoints = 99;
    prog.lastUpdated = Date.now();
    await repo.update(prog);
    const updated = await repo.findByPlayerId('p1');
    expect(updated.skillPoints).toBe(99);
  });

  test('update_nonExistentProgression_throwsNotFoundError', async () => {
    const ghost = makeProgression({ playerId: 'p2' });
    ghost.lastUpdated = Date.now();
    await expect(repo.update(ghost)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('update_missingPlayerId_throwsValidationError', async () => {
    await expect(repo.update({})).rejects.toBeInstanceOf(ValidationError);
  });

  test('getTopByLevel_multipleEntries_returnsOrderedByLevel', async () => {
    await repo.create(makeProgression({ playerId: 'p1', accountLevel: 5, totalXPEarned: 100 }));
    await repo.create(makeProgression({ playerId: 'p2', accountLevel: 10, totalXPEarned: 200 }));
    const top = await repo.getTopByLevel(5);
    expect(top[0].progression.accountLevel).toBe(10);
  });

  test('getTopByPrestige_multipleEntries_returnsOrderedByPrestige', async () => {
    await repo.create(makeProgression({ playerId: 'p1', prestigeLevel: 1 }));
    await repo.create(makeProgression({ playerId: 'p2', prestigeLevel: 3 }));
    const top = await repo.getTopByPrestige(5);
    expect(top[0].progression.prestigeLevel).toBe(3);
  });

  test('getAllSkills_seedData_returnsSkillObjects', async () => {
    const skills = await repo.getAllSkills();
    expect(skills.length).toBeGreaterThanOrEqual(2);
    expect(skills[0]).toHaveProperty('skillId');
  });

  test('getSkillById_existingSkill_returnsSkillObject', async () => {
    const skill = await repo.getSkillById('dmg1');
    expect(skill).not.toBeNull();
    expect(skill.skillId).toBe('dmg1');
  });

  test('getSkillById_unknownSkill_returnsNull', async () => {
    const skill = await repo.getSkillById('nonexistent');
    expect(skill).toBeNull();
  });

  test('getSkillsByIds_existingIds_returnsBothSkills', async () => {
    const results = await repo.getSkillsByIds(['dmg1', 'spd1']);
    expect(results).toHaveLength(2);
  });

  test('getSkillsByIds_emptyArray_returnsEmptyArray', async () => {
    const results = await repo.getSkillsByIds([]);
    expect(results).toHaveLength(0);
  });

  test('getSkillsByIds_cachesPreparedStatement', async () => {
    await repo.getSkillsByIds(['dmg1']);
    await repo.getSkillsByIds(['dmg1']);
    expect(repo._skillsByIdsStmts.has(1)).toBe(true);
  });
});
