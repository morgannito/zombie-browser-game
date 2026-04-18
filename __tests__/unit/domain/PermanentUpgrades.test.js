/**
 * Unit tests for lib/domain/entities/PermanentUpgrades.js
 */

const PermanentUpgrades = require('../../../lib/domain/entities/PermanentUpgrades');

function makeUpgrades(overrides = {}) {
  return new PermanentUpgrades({ playerId: 'player-001', ...overrides });
}

describe('PermanentUpgrades constructor', () => {
  test('applies defaults', () => {
    const u = makeUpgrades();
    expect(u.maxHealthLevel).toBe(0);
    expect(u.damageLevel).toBe(0);
    expect(u.speedLevel).toBe(0);
    expect(u.fireRateLevel).toBe(0);
  });

  test('throws when playerId missing', () => {
    expect(() => new PermanentUpgrades({ playerId: '' })).toThrow('playerId is required');
  });

  test('throws when level out of range', () => {
    expect(() => makeUpgrades({ maxHealthLevel: -1 })).toThrow('maxHealthLevel must be between 0 and 10');
    expect(() => makeUpgrades({ damageLevel: 11 })).toThrow('damageLevel must be between 0 and 10');
  });
});

describe('upgrade', () => {
  test('increments a valid stat', () => {
    const u = makeUpgrades();
    u.upgrade('maxHealth');
    expect(u.maxHealthLevel).toBe(1);
  });

  test('throws on invalid stat name', () => {
    const u = makeUpgrades();
    expect(() => u.upgrade('unknown')).toThrow('Invalid stat name: unknown');
  });

  test('throws when already at max level', () => {
    const u = makeUpgrades({ maxHealthLevel: 10 });
    expect(() => u.upgrade('maxHealth')).toThrow('maxHealth is already at max level (10)');
  });

  test('respects custom maxLevel argument', () => {
    const u = makeUpgrades({ damageLevel: 5 });
    expect(() => u.upgrade('damage', 5)).toThrow('damage is already at max level (5)');
  });

  test('updates updatedAt', () => {
    const u = makeUpgrades({ updatedAt: 1000 });
    u.upgrade('speed');
    expect(u.updatedAt).toBeGreaterThan(1000);
  });
});

describe('getLevel', () => {
  test('returns correct level for known stat', () => {
    const u = makeUpgrades({ speedLevel: 3 });
    expect(u.getLevel('speed')).toBe(3);
  });

  test('returns 0 for unknown stat', () => {
    const u = makeUpgrades();
    expect(u.getLevel('unknown')).toBe(0);
  });
});

describe('isMaxLevel', () => {
  test('returns true at max', () => {
    const u = makeUpgrades({ fireRateLevel: 10 });
    expect(u.isMaxLevel('fireRate')).toBe(true);
  });

  test('returns false below max', () => {
    const u = makeUpgrades({ fireRateLevel: 9 });
    expect(u.isMaxLevel('fireRate')).toBe(false);
  });
});

describe('getTotalUpgrades', () => {
  test('sums all levels', () => {
    const u = makeUpgrades({ maxHealthLevel: 2, damageLevel: 3, speedLevel: 1, fireRateLevel: 4 });
    expect(u.getTotalUpgrades()).toBe(10);
  });
});

describe('getAllLevels', () => {
  test('returns all levels as object', () => {
    const u = makeUpgrades({ maxHealthLevel: 1, damageLevel: 2, speedLevel: 3, fireRateLevel: 4 });
    expect(u.getAllLevels()).toEqual({ maxHealth: 1, damage: 2, speed: 3, fireRate: 4 });
  });
});

describe('toObject', () => {
  test('returns serializable plain object', () => {
    const u = makeUpgrades({ maxHealthLevel: 1, updatedAt: 5000 });
    const obj = u.toObject();
    expect(obj.playerId).toBe('player-001');
    expect(obj.maxHealthLevel).toBe(1);
    expect(obj.updatedAt).toBe(5000);
  });
});

describe('fromDB', () => {
  test('reconstructs from database row', () => {
    const row = {
      player_id: 'db-p-1',
      max_health_level: 3,
      damage_level: 2,
      speed_level: 1,
      fire_rate_level: 0,
      updated_at: 1700000000
    };
    const u = PermanentUpgrades.fromDB(row);
    expect(u.playerId).toBe('db-p-1');
    expect(u.maxHealthLevel).toBe(3);
    expect(u.damageLevel).toBe(2);
    expect(u.speedLevel).toBe(1);
    expect(u.fireRateLevel).toBe(0);
    expect(u.updatedAt).toBe(1700000000 * 1000);
  });
});
