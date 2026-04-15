/**
 * Unit tests for contexts/weapons/modules/BulletEffects.js
 * Focus: explosive, chain lightning, poison dart, ice cannon side effects.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  WEAPONS: {
    chainLightning: {
      chainMaxJumps: 3,
      chainRange: 200,
      chainDamageReduction: 0.7,
      color: '#00ffff'
    },
    poisonDart: {
      poisonDamage: 10,
      poisonDuration: 3000,
      poisonSpreadRadius: 100,
      poisonSpreadChance: 1.0
    },
    iceCannon: {
      freezeChance: 0,
      freezeDuration: 2000,
      slowDuration: 3000,
      slowAmount: 0.5,
      iceExplosionRadius: 80
    }
  }
}));

jest.mock('../../../../lib/MathUtils', () => ({
  distanceSquared: (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn(),
  createExplosion: jest.fn(),
  createLoot: jest.fn()
}));

const {
  handleExplosiveBullet,
  handleChainLightning,
  handlePoisonDart,
  handleIceCannon
} = require('../BulletEffects');

describe('handleExplosiveBullet', () => {
  test('no-op when not explosive', () => {
    const bullet = { explosiveRounds: false };
    const zombie = { x: 0, y: 0 };
    const gameState = { zombies: {} };
    handleExplosiveBullet(bullet, zombie, 'z1', gameState, {});
    expect(gameState.zombies).toEqual({});
  });

  test('no-op when explosion radius ≤ 0', () => {
    const bullet = { explosiveRounds: true, explosionRadius: 0 };
    const gameState = { zombies: {} };
    handleExplosiveBullet(bullet, { x: 0, y: 0 }, 'z1', gameState, {});
    expect(gameState.zombies).toEqual({});
  });

  test('damages other zombies in radius, skips epicenter', () => {
    const bullet = {
      explosiveRounds: true,
      explosionRadius: 100,
      damage: 50,
      explosionDamagePercent: 0.5,
      rocketExplosionDamage: null
    };
    const epicenter = { x: 0, y: 0 };
    const near = { x: 20, y: 0, color: '#f00', health: 100 };
    const far = { x: 500, y: 0, color: '#f00', health: 100 };
    const gameState = { zombies: { z1: epicenter, z2: near, z3: far } };
    handleExplosiveBullet(bullet, epicenter, 'z1', gameState, {});
    expect(near.health).toBe(75); // 100 - 50*0.5
    expect(far.health).toBe(100);
  });

  test('rocket explosion uses explicit rocketExplosionDamage', () => {
    const bullet = {
      explosiveRounds: true, isRocket: true,
      explosionRadius: 100,
      damage: 50, explosionDamagePercent: 0.5,
      rocketExplosionDamage: 200
    };
    const other = { x: 20, y: 0, color: '#f00', health: 100 };
    const gameState = { zombies: { z1: { x: 0, y: 0 }, z2: other } };
    handleExplosiveBullet(bullet, { x: 0, y: 0 }, 'z1', gameState, {});
    expect(other.health).toBe(-100); // 100 - 200
  });

  test('chain-kill path awards combo + drops loot', () => {
    const bullet = {
      explosiveRounds: true, explosionRadius: 100,
      damage: 200, explosionDamagePercent: 1.0,
      rocketExplosionDamage: null,
      playerId: 'p1'
    };
    const doomed = { x: 20, y: 0, color: '#f00', health: 10, goldDrop: 5, xpDrop: 5 };
    const shooter = {};
    const gameState = {
      zombies: { z1: { x: 0, y: 0 }, z2: doomed },
      players: { p1: shooter },
      zombiesKilledThisWave: 0
    };
    handleExplosiveBullet(bullet, { x: 0, y: 0 }, 'z1', gameState, {});
    expect(gameState.zombies.z2).toBeUndefined();
    expect(shooter.kills).toBe(1);
    expect(shooter.combo).toBe(1);
    expect(gameState.zombiesKilledThisWave).toBe(1);
  });
});

describe('handleChainLightning', () => {
  test('no-op when bullet not chain lightning', () => {
    const bullet = { isChainLightning: false };
    handleChainLightning(bullet, {}, 'z1', { zombies: {} }, {}, {}, {});
    expect(bullet.chainJumps).toBeUndefined();
  });

  test('initializes chain state on first hit', () => {
    const bullet = { isChainLightning: true, damage: 100 };
    const zombie = { x: 0, y: 0, health: 100, color: '#f00' };
    const gameState = { zombies: { z1: zombie } };
    handleChainLightning(bullet, zombie, 'z1', gameState, {}, {}, { emit: jest.fn() });
    expect(bullet.chainJumps).toBe(0);
    expect(bullet.chainedZombies).toEqual(['z1']);
  });

  test('jumps to nearest unchained zombie within range', () => {
    const bullet = {
      isChainLightning: true, damage: 100,
      chainJumps: 0, chainedZombies: ['z1']
    };
    const source = { x: 0, y: 0, color: '#f00' };
    const target = { x: 50, y: 0, health: 100, color: '#f00' };
    const far = { x: 500, y: 0, health: 100, color: '#f00' };
    const gameState = { zombies: { z1: source, z2: target, z3: far } };
    const io = { emit: jest.fn() };
    handleChainLightning(bullet, source, 'z1', gameState, {}, {}, io);
    expect(bullet.chainJumps).toBe(1);
    expect(bullet.chainedZombies).toContain('z2');
    expect(target.health).toBeLessThan(100);
  });

  test('no jump when max jumps reached', () => {
    const bullet = {
      isChainLightning: true, damage: 100,
      chainJumps: 3, chainedZombies: ['z1', 'z2', 'z3', 'z4']
    };
    const source = { x: 0, y: 0 };
    const other = { x: 50, y: 0, health: 100, color: '#f00' };
    const gameState = { zombies: { z1: source, z5: other } };
    handleChainLightning(bullet, source, 'z1', gameState, {}, {}, { emit: jest.fn() });
    expect(other.health).toBe(100);
  });
});

describe('handlePoisonDart', () => {
  test('no-op when not poison dart', () => {
    const zombie = {};
    handlePoisonDart({ isPoisonDart: false }, zombie, 'z1', { zombies: {} }, {});
    expect(zombie.poisoned).toBeUndefined();
  });

  test('applies poison to primary target', () => {
    const bullet = { isPoisonDart: true };
    const zombie = { x: 0, y: 0 };
    const gameState = { zombies: { z1: zombie } };
    handlePoisonDart(bullet, zombie, 'z1', gameState, {});
    expect(zombie.poisoned).toBeDefined();
    expect(zombie.poisoned.damage).toBe(10);
  });

  test('spreads poison to nearby non-poisoned zombies', () => {
    const bullet = { isPoisonDart: true };
    const primary = { x: 0, y: 0 };
    const nearby = { x: 20, y: 0 };
    const far = { x: 500, y: 0 };
    const gameState = { zombies: { z1: primary, z2: nearby, z3: far } };
    handlePoisonDart(bullet, primary, 'z1', gameState, {});
    expect(nearby.poisoned).toBeDefined();
    expect(far.poisoned).toBeUndefined();
  });

  test('does not re-poison already poisoned zombie', () => {
    const existing = { damage: 999 };
    const zombie = { x: 0, y: 0, poisoned: existing };
    handlePoisonDart({ isPoisonDart: true }, zombie, 'z1', { zombies: { z1: zombie } }, {});
    expect(zombie.poisoned).toBe(existing); // untouched
  });
});

describe('handleIceCannon', () => {
  test('no-op when not ice cannon', () => {
    const zombie = { speed: 5 };
    handleIceCannon({ isIceCannon: false }, zombie, 'z1', { zombies: {} }, {});
    expect(zombie.slowed).toBeUndefined();
  });

  test('slows zombie (freezeChance=0 → slow branch)', () => {
    const zombie = { x: 0, y: 0, speed: 5, baseSpeed: 5 };
    const gameState = { zombies: { z1: zombie } };
    handleIceCannon({ isIceCannon: true }, zombie, 'z1', gameState, {});
    expect(zombie.slowed).toBeDefined();
    expect(zombie.speed).toBe(2.5); // 5 * (1 - 0.5)
  });

  test('applies area slow to nearby zombies', () => {
    const zombie = { x: 0, y: 0, speed: 5, baseSpeed: 5 };
    const neighbour = { x: 20, y: 0, speed: 5, baseSpeed: 5 };
    const far = { x: 500, y: 0, speed: 5, baseSpeed: 5 };
    const gameState = { zombies: { z1: zombie, z2: neighbour, z3: far } };
    handleIceCannon({ isIceCannon: true }, zombie, 'z1', gameState, {});
    expect(neighbour.slowed).toBeDefined();
    expect(far.slowed).toBeUndefined();
  });

  test('area effect skips already-slowed with remaining duration', () => {
    const zombie = { x: 0, y: 0, speed: 5, baseSpeed: 5 };
    const preExisting = {
      x: 20, y: 0, speed: 2,
      slowed: { endTime: Date.now() + 999999, originalSpeed: 5 }
    };
    const gameState = { zombies: { z1: zombie, z2: preExisting } };
    handleIceCannon({ isIceCannon: true }, zombie, 'z1', gameState, {});
    expect(preExisting.slowed.endTime).toBeGreaterThan(Date.now() + 99999);
  });
});
