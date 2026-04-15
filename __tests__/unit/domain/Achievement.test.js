/**
 * Unit tests for lib/domain/entities/Achievement.js
 */

const Achievement = require('../../../lib/domain/entities/Achievement');

function makeAchievement(overrides = {}) {
  return new Achievement({
    id: 'test_ach',
    category: 'combat',
    name: 'Test',
    description: 'Desc',
    iconUrl: 'icon.png',
    requirementJson: { totalKills: 100 },
    ...overrides
  });
}

describe('Achievement constructor', () => {
  test('applies defaults for points, tier, hidden, sortOrder', () => {
    const a = makeAchievement();
    expect(a.points).toBe(10);
    expect(a.tier).toBe('bronze');
    expect(a.hidden).toBe(false);
    expect(a.sortOrder).toBe(0);
  });

  test('parses requirementJson string', () => {
    const a = makeAchievement({ requirementJson: '{"zombiesKilled":50}' });
    expect(a.requirements).toEqual({ zombiesKilled: 50 });
  });

  test('keeps requirements object if already parsed', () => {
    const a = makeAchievement({ requirementJson: { bossKills: 3 } });
    expect(a.requirements).toEqual({ bossKills: 3 });
  });

  test('honors custom tier and hidden flag', () => {
    const a = makeAchievement({ tier: 'gold', hidden: true, points: 50 });
    expect(a.tier).toBe('gold');
    expect(a.hidden).toBe(true);
    expect(a.points).toBe(50);
  });
});

describe('checkRequirements', () => {
  const cases = [
    ['totalKills', { totalKills: 100 }, { totalKills: 100 }, true],
    ['totalKills short', { totalKills: 100 }, { totalKills: 99 }, false],
    ['zombiesKilled', { zombiesKilled: 50 }, { zombiesKilled: 75 }, true],
    ['zombiesKilled short', { zombiesKilled: 50 }, { zombiesKilled: 49 }, false],
    ['bossKills', { bossKills: 3 }, { bossKills: 3 }, true],
    ['bossKills short', { bossKills: 3 }, { bossKills: 2 }, false],
    ['highestWave', { highestWave: 10 }, { highestWave: 12 }, true],
    ['highestLevel', { highestLevel: 20 }, { highestLevel: 19 }, false],
    ['totalPlaytimeSeconds', { totalPlaytimeSeconds: 3600 }, { totalPlaytimeSeconds: 3600 }, true],
    ['longestSurvivalSeconds short', { longestSurvivalSeconds: 600 }, { longestSurvivalSeconds: 599 }, false],
    ['highestCombo', { highestCombo: 50 }, { highestCombo: 100 }, true],
    ['gamesPlayed', { gamesPlayed: 10 }, { gamesPlayed: 10 }, true],
    ['gamesWon short', { gamesWon: 5 }, { gamesWon: 4 }, false]
  ];

  test.each(cases)('%s → %s', (_name, reqs, stats, expected) => {
    const a = makeAchievement({ requirementJson: reqs });
    expect(a.checkRequirements(stats)).toBe(expected);
  });

  test('returns true when no requirements set', () => {
    const a = makeAchievement({ requirementJson: {} });
    expect(a.checkRequirements({})).toBe(true);
  });

  test('combines multiple requirements with AND semantics', () => {
    const a = makeAchievement({ requirementJson: { totalKills: 100, bossKills: 3 } });
    expect(a.checkRequirements({ totalKills: 100, bossKills: 3 })).toBe(true);
    expect(a.checkRequirements({ totalKills: 100, bossKills: 2 })).toBe(false);
    expect(a.checkRequirements({ totalKills: 50, bossKills: 3 })).toBe(false);
  });
});

describe('toObject', () => {
  test('returns plain serializable representation', () => {
    const a = makeAchievement({ points: 25, tier: 'silver', hidden: true, sortOrder: 5 });
    const obj = a.toObject();
    expect(obj).toEqual({
      id: 'test_ach',
      category: 'combat',
      name: 'Test',
      description: 'Desc',
      iconUrl: 'icon.png',
      points: 25,
      tier: 'silver',
      requirements: { totalKills: 100 },
      hidden: true,
      sortOrder: 5
    });
  });
});
