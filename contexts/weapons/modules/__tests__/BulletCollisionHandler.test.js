/**
 * Unit tests for contexts/weapons/modules/BulletCollisionHandler.js
 * Focus: damage math, life-steal, piercing, dead-zombie TTL, combo loot bonus.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { PLAYER_SIZE: 20, BULLET_SIZE: 4 },
  ZOMBIE_TYPES: {
    shielded: {
      shieldAngle: Math.PI / 4,
      frontDamageReduction: 0.3
    },
    bossColosse: {
      shieldDamageReduction: 0.8,
      shieldColor: '#aaaaff'
    },
    explosive: {
      explosionRadius: 80,
      explosionDamage: 40
    }
  }
}));

jest.mock('../../../../game/utilityFunctions', () => ({
  distance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn(),
  createLoot: jest.fn(),
  createExplosion: jest.fn()
}));

jest.mock('../BulletEffects', () => ({
  handleExplosiveBullet: jest.fn(),
  handleChainLightning: jest.fn(),
  handlePoisonDart: jest.fn(),
  handleIceCannon: jest.fn()
}));

jest.mock('../../../zombie/modules/ZombieEffects', () => ({
  handleSplitterDeath: jest.fn()
}));

jest.mock('../../../wave/modules/WaveManager', () => ({
  handleNewWave: jest.fn()
}));

jest.mock('../../../player/modules/PlayerProgression', () => ({
  updatePlayerCombo: jest.fn(() => null)
}));

jest.mock('../../../../game/gameLoop', () => ({
  handlePlayerDeathProgression: jest.fn()
}));

const {
  handleZombieBulletCollisions,
  handlePlayerBulletCollisions,
  calculateFinalDamage,
  applyLifeSteal,
  handlePiercing,
  saveDeadZombie,
  evictExpiredDeadZombies,
  calculateLootBonus,
  cleanupZombieDamageTracking,
  handleExplosiveZombieDeath
} = require('../BulletCollisionHandler');

const { updatePlayerCombo } = require('../../../player/modules/PlayerProgression');

describe('calculateFinalDamage', () => {
  test('baseline returns bullet damage', () => {
    const bullet = { damage: 50, vx: 1, vy: 0 };
    const zombie = { type: 'normal', x: 0, y: 0 };
    expect(calculateFinalDamage(bullet, zombie, {})).toBe(50);
  });

  test('shielded zombie reduces front damage', () => {
    const bullet = { damage: 100, vx: 1, vy: 0 };
    const zombie = { type: 'shielded', facingAngle: 0, x: 0, y: 0 };
    // Bullet facing zombie front → angleDiff small → reduced
    expect(calculateFinalDamage(bullet, zombie, {})).toBe(30); // 100 * 0.3
  });

  test('shielded back-hit takes full damage', () => {
    const bullet = { damage: 100, vx: 1, vy: 0 };
    const zombie = { type: 'shielded', facingAngle: Math.PI, x: 0, y: 0 };
    // Bullet approaching from behind → angleDiff large
    expect(calculateFinalDamage(bullet, zombie, {})).toBe(100);
  });

  test('bossColosse with shield reduces damage', () => {
    const bullet = { damage: 100, vx: 1, vy: 0 };
    const zombie = { type: 'bossColosse', hasShield: true };
    expect(calculateFinalDamage(bullet, zombie, {})).toBeCloseTo(20); // 100 * (1-0.8)
  });

  test('bossColosse without shield takes full damage', () => {
    const bullet = { damage: 100, vx: 1, vy: 0 };
    const zombie = { type: 'bossColosse', hasShield: false };
    expect(calculateFinalDamage(bullet, zombie, {})).toBe(100);
  });
});

describe('applyLifeSteal', () => {
  test('no-op without playerId', () => {
    const gameState = { players: {} };
    applyLifeSteal({}, gameState, 50);
    // no crash
  });

  test('restores shooter health up to maxHealth', () => {
    const shooter = { health: 50, maxHealth: 100, lifeSteal: 0.5 };
    const gameState = { players: { p1: shooter } };
    applyLifeSteal({ playerId: 'p1' }, gameState, 60);
    expect(shooter.health).toBe(80); // +30
  });

  test('caps at maxHealth', () => {
    const shooter = { health: 90, maxHealth: 100, lifeSteal: 1.0 };
    const gameState = { players: { p1: shooter } };
    applyLifeSteal({ playerId: 'p1' }, gameState, 50);
    expect(shooter.health).toBe(100);
  });

  test('no-op when lifeSteal is 0', () => {
    const shooter = { health: 50, maxHealth: 100, lifeSteal: 0 };
    const gameState = { players: { p1: shooter } };
    applyLifeSteal({ playerId: 'p1' }, gameState, 50);
    expect(shooter.health).toBe(50);
  });
});

describe('handlePiercing', () => {
  test('destroys non-piercing bullet', () => {
    const bullet = { piercing: 0 };
    const em = { destroyBullet: jest.fn() };
    handlePiercing(bullet, 'b1', 'z1', em);
    expect(em.destroyBullet).toHaveBeenCalledWith('b1');
  });

  test('tracks pierced zombie and keeps bullet alive under limit', () => {
    const bullet = { piercing: 3, piercedZombies: [] };
    const em = { destroyBullet: jest.fn() };
    handlePiercing(bullet, 'b1', 'z1', em);
    expect(bullet.piercedZombies).toContain('z1');
    expect(em.destroyBullet).not.toHaveBeenCalled();
  });

  test('destroys bullet after exceeding piercing limit', () => {
    const bullet = { piercing: 2, piercedZombies: ['a', 'b'] };
    const em = { destroyBullet: jest.fn() };
    handlePiercing(bullet, 'b1', 'c', em);
    expect(em.destroyBullet).toHaveBeenCalledWith('b1');
  });
});

describe('evictExpiredDeadZombies', () => {
  test('removes entries older than TTL', () => {
    const now = 100000;
    const dead = {
      recent: { deathTime: now - 1000 },
      old: { deathTime: now - 60000 }
    };
    evictExpiredDeadZombies(dead, now);
    expect(dead.recent).toBeDefined();
    expect(dead.old).toBeUndefined();
  });

  test('keeps entries within TTL window', () => {
    const now = 100000;
    const dead = { fresh: { deathTime: now - 5000 } };
    evictExpiredDeadZombies(dead, now);
    expect(dead.fresh).toBeDefined();
  });
});

describe('saveDeadZombie', () => {
  test('persists zombie snapshot to deadZombies map', () => {
    const zombie = {
      x: 100, y: 50, type: 'normal', size: 20, color: '#f00',
      maxHealth: 100, speed: 2, damage: 5, goldDrop: 3, xpDrop: 3
    };
    const gameState = {};
    saveDeadZombie(zombie, gameState);
    expect(gameState.deadZombies).toBeDefined();
    const keys = Object.keys(gameState.deadZombies);
    expect(keys).toHaveLength(1);
    expect(gameState.deadZombies[keys[0]].x).toBe(100);
  });

  test('reuses existing deadZombies map', () => {
    const gameState = { deadZombies: { old: { deathTime: Date.now() - 1000 } } };
    saveDeadZombie({ x: 0, y: 0, size: 20 }, gameState);
    expect(Object.keys(gameState.deadZombies)).toHaveLength(2);
  });
});

describe('calculateLootBonus', () => {
  beforeEach(() => updatePlayerCombo.mockReset().mockReturnValue(null));

  test('returns base drops without playerId', () => {
    const zombie = { goldDrop: 10, xpDrop: 5 };
    expect(calculateLootBonus({}, zombie, {}, {})).toEqual({ goldBonus: 10, xpBonus: 5 });
  });

  test('returns base drops when combo yields nothing', () => {
    const zombie = { goldDrop: 10, xpDrop: 5 };
    const result = calculateLootBonus({ playerId: 'p1' }, zombie, {}, {});
    expect(result.goldBonus).toBe(10);
    expect(result.xpBonus).toBe(5);
  });

  test('applies combo multiplier when present', () => {
    updatePlayerCombo.mockReturnValue({ goldBonus: 30, xpBonus: 20 });
    const result = calculateLootBonus({ playerId: 'p1' }, { goldDrop: 10, xpDrop: 5 }, {}, {});
    expect(result).toEqual({ goldBonus: 30, xpBonus: 20 });
  });
});

describe('cleanupZombieDamageTracking', () => {
  test('deletes zombie entry from each player damage map', () => {
    const p1 = { lastDamageTime: { z1: 100, z2: 200 } };
    const p2 = { lastDamageTime: { z1: 150 } };
    const gameState = { players: { p1, p2 } };
    cleanupZombieDamageTracking('z1', gameState);
    expect(p1.lastDamageTime.z1).toBeUndefined();
    expect(p1.lastDamageTime.z2).toBe(200);
    expect(p2.lastDamageTime.z1).toBeUndefined();
  });

  test('ignores players without lastDamageTime', () => {
    const p1 = {};
    const gameState = { players: { p1 } };
    expect(() => cleanupZombieDamageTracking('z1', gameState)).not.toThrow();
  });
});

describe('handleZombieBulletCollisions', () => {
  test('damages player on hit', () => {
    const bullet = { x: 0, y: 0, damage: 25 };
    const player = { alive: true, hasNickname: true, x: 10, y: 0, health: 100 };
    const gameState = { players: { p1: player } };
    const em = { destroyBullet: jest.fn() };
    handleZombieBulletCollisions(bullet, 'b1', gameState, em);
    expect(player.health).toBe(75);
    expect(em.destroyBullet).toHaveBeenCalled();
  });

  test('skips players without nickname / dead / protected', () => {
    const bullet = { x: 0, y: 0, damage: 25 };
    const dead = { alive: false, hasNickname: true, x: 10, y: 0, health: 100 };
    const noNick = { alive: true, hasNickname: false, x: 10, y: 0, health: 100 };
    const protectedP = { alive: true, hasNickname: true, x: 10, y: 0, health: 100, spawnProtection: true };
    const gameState = { players: { a: dead, b: noNick, c: protectedP } };
    const em = { destroyBullet: jest.fn() };
    handleZombieBulletCollisions(bullet, 'b1', gameState, em);
    expect(dead.health).toBe(100);
    expect(noNick.health).toBe(100);
    expect(protectedP.health).toBe(100);
    expect(em.destroyBullet).not.toHaveBeenCalled();
  });
});

describe('handlePlayerBulletCollisions integration', () => {
  test('damages zombies returned by collisionManager', () => {
    const bullet = {
      damage: 50, piercing: 0, piercedZombies: [],
      vx: 1, vy: 0
    };
    const zombie = { type: 'normal', health: 100, x: 0, y: 0, color: '#f00' };
    const gameState = { bullets: { b1: bullet }, zombies: { z1: zombie }, players: {} };
    const cm = { checkBulletZombieCollisions: () => [{ id: 'z1', zombie }] };
    const em = { destroyBullet: jest.fn() };
    handlePlayerBulletCollisions(bullet, 'b1', gameState, {}, cm, em, {});
    expect(zombie.health).toBe(50);
    expect(em.destroyBullet).toHaveBeenCalled();
  });

  test('skips already-pierced zombies', () => {
    const bullet = {
      damage: 50, piercing: 5, piercedZombies: ['z1'],
      vx: 1, vy: 0
    };
    const zombie = { type: 'normal', health: 100, x: 0, y: 0, color: '#f00' };
    const gameState = { bullets: { b1: bullet }, zombies: { z1: zombie }, players: {} };
    const cm = { checkBulletZombieCollisions: () => [{ id: 'z1', zombie }] };
    handlePlayerBulletCollisions(bullet, 'b1', gameState, {}, cm, { destroyBullet: jest.fn() }, {});
    expect(zombie.health).toBe(100);
  });
});

// REGRESSION (audit round 2): explosive zombie death must use quadtree broad-phase
// when available — previously it looped through gameState.zombies in O(n).
describe('handleExplosiveZombieDeath quadtree usage (regression)', () => {
  test('uses quadtree.queryRadius when collisionManager.quadtree is present', () => {
    const queryRadius = jest.fn(() => []);
    const gameState = {
      zombies: { z1: { id: 'z1', x: 0, y: 0, health: 100, color: '#f00' } },
      players: {},
      collisionManager: { quadtree: { queryRadius } }
    };
    const em = {};
    handleExplosiveZombieDeath(
      { id: 'z1', x: 0, y: 0, color: '#f00' },
      'z1',
      gameState,
      em
    );
    expect(queryRadius).toHaveBeenCalledWith(0, 0, 80); // radius from mocked ZOMBIE_TYPES.explosive
  });

  test('falls back to full scan when no quadtree is available', () => {
    const other = { id: 'z2', x: 10, y: 10, health: 100, color: '#0f0' };
    const gameState = {
      zombies: { z1: { id: 'z1', x: 0, y: 0, health: 100 }, z2: other },
      players: {}
    };
    handleExplosiveZombieDeath(
      { id: 'z1', x: 0, y: 0, color: '#f00' },
      'z1',
      gameState,
      {}
    );
    // Fallback must still damage the nearby zombie (40 damage from mocked config)
    expect(other.health).toBe(60);
  });

  test('damages only zombies within explosion radius', () => {
    const near = { id: 'z2', x: 10, y: 10, health: 100, color: '#0f0' };
    const far = { id: 'z3', x: 500, y: 500, health: 100, color: '#00f' };
    const gameState = {
      zombies: { z1: { id: 'z1', x: 0, y: 0 }, z2: near, z3: far },
      players: {}
    };
    handleExplosiveZombieDeath(
      { id: 'z1', x: 0, y: 0, color: '#f00' },
      'z1',
      gameState,
      {}
    );
    expect(near.health).toBe(60);
    expect(far.health).toBe(100);
  });
});
