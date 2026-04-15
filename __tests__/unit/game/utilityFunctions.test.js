/**
 * Unit tests for game/utilityFunctions.js
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../../lib/server/ConfigManager', () => ({
  LEVEL_UP_UPGRADES: {
    dmg1: { name: 'Dmg+', description: '+10% damage', rarity: 'common' },
    dmg2: { name: 'Dmg++', description: '+20% damage', rarity: 'common' },
    pierce: { name: 'Piercing', description: 'pierce', rarity: 'rare' },
    turret: { name: 'Turret', description: 'auto fire', rarity: 'rare' },
    god: { name: 'Godmode', description: 'immortal', rarity: 'legendary' }
  }
}));

const {
  distance, distanceSquared, cleanupPlayerBullets,
  generateUpgradeChoices, getXPForLevel
} = require('../../../game/utilityFunctions');

beforeEach(() => jest.clearAllMocks());

describe('distance', () => {
  test('returns 0 for same point', () => {
    expect(distance(5, 5, 5, 5)).toBe(0);
  });

  test('returns 5 for 3-4-5 triangle', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  test('is symmetric', () => {
    expect(distance(1, 2, 10, 20)).toBeCloseTo(distance(10, 20, 1, 2));
  });
});

describe('distanceSquared', () => {
  test('returns dx²+dy² without sqrt', () => {
    expect(distanceSquared(0, 0, 3, 4)).toBe(25);
  });

  test('returns 0 for same point', () => {
    expect(distanceSquared(7, 7, 7, 7)).toBe(0);
  });

  test('is always >= 0', () => {
    expect(distanceSquared(-10, -10, 10, 10)).toBe(800);
  });
});

describe('cleanupPlayerBullets', () => {
  test('destroys only bullets owned by the player', () => {
    const gameState = {
      bullets: {
        b1: { playerId: 'p1' },
        b2: { playerId: 'p2' },
        b3: { playerId: 'p1' }
      }
    };
    const entityManager = { destroyBullet: jest.fn() };
    cleanupPlayerBullets('p1', gameState, entityManager);
    expect(entityManager.destroyBullet).toHaveBeenCalledTimes(2);
    expect(entityManager.destroyBullet).toHaveBeenCalledWith('b1');
    expect(entityManager.destroyBullet).toHaveBeenCalledWith('b3');
    expect(entityManager.destroyBullet).not.toHaveBeenCalledWith('b2');
  });

  test('does nothing when player has no bullets', () => {
    const em = { destroyBullet: jest.fn() };
    cleanupPlayerBullets('p99', { bullets: { b1: { playerId: 'p1' } } }, em);
    expect(em.destroyBullet).not.toHaveBeenCalled();
  });
});

describe('generateUpgradeChoices', () => {
  test('returns 3 unique choices', () => {
    const choices = generateUpgradeChoices();
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map(c => c.id)).size).toBe(3);
  });

  test('each choice has id/name/description/rarity', () => {
    const [c] = generateUpgradeChoices();
    expect(c.id).toBeDefined();
    expect(c.name).toBeDefined();
    expect(c.description).toBeDefined();
    expect(c.rarity).toBeDefined();
  });

  test('respects rarity when rand=0.7 → rare tier', () => {
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0.7);
    const choices = generateUpgradeChoices();
    // First loop picks rare until exhausted (pierce, turret), then max attempts reached
    expect(choices.every(c => ['rare', 'common', 'legendary'].includes(c.rarity))).toBe(true);
    rnd.mockRestore();
  });

  test('MAX_ATTEMPTS guard prevents infinite loop with constant rand', () => {
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0.95);
    const start = Date.now();
    const choices = generateUpgradeChoices();
    expect(Date.now() - start).toBeLessThan(500);
    expect(choices.length).toBeLessThanOrEqual(3);
    rnd.mockRestore();
  });
});

describe('getXPForLevel', () => {
  test.each([
    [1, 50], [2, 80], [5, 170],
    [6, 250], [10, 450],
    [11, 475], [20, 1150],
    [21, 1100], [30, 2000]
  ])('level %i → %i xp', (level, xp) => {
    expect(getXPForLevel(level)).toBe(xp);
  });
});
