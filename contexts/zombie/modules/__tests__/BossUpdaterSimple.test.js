/**
 * Unit tests for contexts/zombie/modules/BossUpdaterSimple.js
 * Focus: cooldown gates, phase transitions, enrage triggers.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { ROOM_WIDTH: 2000, ROOM_HEIGHT: 2000, ZOMBIE_SIZE: 20 },
  ZOMBIE_TYPES: {
    bossCharnier: { color: '#800080', spawnCooldown: 2000, spawnCount: 3 },
    bossInfect: {
      color: '#008800',
      toxicPoolCooldown: 3000,
      toxicPoolRadius: 80,
      toxicPoolDamage: 10,
      toxicPoolDuration: 5000,
      deathAuraRadius: 80,
      deathAuraDamage: 5
    },
    bossColosse: {
      color: '#333333',
      shieldColor: '#aaaaff',
      enrageThreshold: 0.3,
      enrageSpeedMultiplier: 2,
      enrageDamageMultiplier: 1.5
    },
    bossRoi: {
      color: '#ffaa00',
      phase2Threshold: 0.66,
      phase3Threshold: 0.33,
      teleportCooldown: 5000,
      teleportRange: 300,
      teleportMinRange: 100,
      summonCooldown: 4000
    },
    bossOmega: {
      color: '#ff0055',
      phase2Threshold: 0.66,
      phase3Threshold: 0.33,
      abilityCooldown: 3000
    }
  }
}));

jest.mock('../../../../game/utilityFunctions', () => ({
  distance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn()
}));

jest.mock('../../../../game/gameLoop', () => ({
  handlePlayerDeathProgression: jest.fn()
}));

const {
  updateBossCharnier,
  updateBossInfect,
  updateBossColosse,
  updateBossRoi
} = require('../BossUpdaterSimple');

describe('updateBossCharnier', () => {
  test('type-guard: no-op on wrong type', () => {
    const zm = { spawnSingleZombie: jest.fn() };
    updateBossCharnier({ type: 'normal' }, 1000, zm, {}, {}, { zombies: {} });
    expect(zm.spawnSingleZombie).not.toHaveBeenCalled();
  });

  test('spawns N zombies when cooldown elapsed and perf allows', () => {
    const zombie = { type: 'bossCharnier', x: 0, y: 0 };
    const zm = { spawnSingleZombie: jest.fn(() => true) };
    const perf = { canSpawnZombie: () => true };
    const gameState = { zombies: {} };
    updateBossCharnier(zombie, 3000, zm, perf, {}, gameState);
    expect(zm.spawnSingleZombie).toHaveBeenCalledTimes(3); // spawnCount
    expect(zombie.lastSpawn).toBe(3000);
  });

  test('skips spawn when perf budget exhausted', () => {
    const zombie = { type: 'bossCharnier', x: 0, y: 0 };
    const zm = { spawnSingleZombie: jest.fn() };
    const perf = { canSpawnZombie: () => false };
    updateBossCharnier(zombie, 3000, zm, perf, {}, { zombies: {} });
    expect(zm.spawnSingleZombie).not.toHaveBeenCalled();
  });

  test('respects spawn cooldown', () => {
    const zombie = { type: 'bossCharnier', lastSpawn: 2500 };
    const zm = { spawnSingleZombie: jest.fn() };
    updateBossCharnier(zombie, 3000, zm, { canSpawnZombie: () => true }, {}, { zombies: {} });
    expect(zm.spawnSingleZombie).not.toHaveBeenCalled();
  });
});

describe('updateBossInfect', () => {
  test('type-guard', () => {
    const gameState = { players: {}, toxicPools: [] };
    updateBossInfect({ type: 'normal' }, 1000, {}, gameState);
    expect(gameState.toxicPools).toEqual([]);
  });

  test('spawns a toxic pool entry on cooldown elapse', () => {
    const zombie = { type: 'bossInfect', x: 50, y: 50 };
    const gameState = { players: {} };
    updateBossInfect(zombie, 4000, {}, gameState);
    expect(gameState.toxicPools).toHaveLength(1);
    expect(gameState.toxicPools[0].x).toBe(50);
    expect(zombie.lastToxicPool).toBe(4000);
  });

  test('aura damages living player within radius', () => {
    const zombie = { type: 'bossInfect', x: 0, y: 0, lastToxicPool: 4000 };
    const player = { alive: true, x: 30, y: 0, health: 100 };
    const gameState = { players: { p1: player }, toxicPools: [] };
    updateBossInfect(zombie, 5100, {}, gameState);
    expect(player.health).toBe(95); // -5 deathAuraDamage
  });

  test('aura skips invulnerable / distant players', () => {
    const zombie = { type: 'bossInfect', x: 0, y: 0, lastToxicPool: 4000 };
    const protectedP = { alive: true, x: 30, y: 0, health: 100, spawnProtection: true };
    const distantP = { alive: true, x: 500, y: 0, health: 100 };
    const gameState = { players: { p1: protectedP, p2: distantP }, toxicPools: [] };
    updateBossInfect(zombie, 5100, {}, gameState);
    expect(protectedP.health).toBe(100);
    expect(distantP.health).toBe(100);
  });
});

describe('updateBossColosse', () => {
  function makeBossColosse(overrides = {}) {
    return {
      type: 'bossColosse', x: 0, y: 0,
      health: 1000, maxHealth: 1000,
      speed: 2, damage: 20,
      ...overrides
    };
  }

  test('type-guard', () => {
    const zombie = { type: 'normal' };
    updateBossColosse(zombie, 'z1', 1000, { emit: jest.fn() }, {});
    expect(zombie.hasShield).toBeUndefined();
  });

  test('shield active while not enraged', () => {
    const zombie = makeBossColosse();
    updateBossColosse(zombie, 'z1', 1000, { emit: jest.fn() }, {});
    expect(zombie.hasShield).toBe(true);
  });

  test('enrage triggers when health ≤ threshold', () => {
    const zombie = makeBossColosse({ health: 200 }); // 20% < 30%
    const io = { emit: jest.fn() };
    updateBossColosse(zombie, 'z1', 1000, io, {});
    expect(zombie.isEnraged).toBe(true);
    expect(zombie.hasShield).toBe(false);
    expect(zombie.speed).toBe(4); // 2 * 2
    expect(zombie.damage).toBe(30); // floor(20 * 1.5)
    expect(io.emit).toHaveBeenCalledWith('bossEnraged', expect.any(Object));
  });

  test('enrage only triggers once (idempotent)', () => {
    const zombie = makeBossColosse({ health: 200, isEnraged: true, speed: 4, damage: 30 });
    const io = { emit: jest.fn() };
    updateBossColosse(zombie, 'z1', 1000, io, {});
    expect(zombie.speed).toBe(4); // unchanged
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('updateBossRoi', () => {
  function makeBossRoi(overrides = {}) {
    return {
      type: 'bossRoi', x: 100, y: 100,
      health: 1000, maxHealth: 1000,
      phase: 1,
      ...overrides
    };
  }

  test('type-guard', () => {
    const zombie = { type: 'normal' };
    const io = { emit: jest.fn() };
    updateBossRoi(zombie, 'z1', 1000, io, {}, {}, {}, {}, {});
    expect(io.emit).not.toHaveBeenCalled();
  });

  test('enters phase 2 when health ≤ phase2Threshold', () => {
    const zombie = makeBossRoi({ health: 500 }); // 50% ≤ 66%
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    updateBossRoi(zombie, 'z1', 1000, io, {}, {}, {}, { players: {}, zombies: {} }, cm);
    expect(zombie.phase).toBe(2);
    expect(io.emit).toHaveBeenCalledWith('bossPhaseChange', expect.objectContaining({ phase: 2 }));
  });

  test('enters phase 3 when health ≤ phase3Threshold', () => {
    const zombie = makeBossRoi({ health: 100 }); // 10% ≤ 33%
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    const zm = { spawnSingleZombie: jest.fn() };
    const perf = { canSpawnZombie: () => false };
    updateBossRoi(zombie, 'z1', 1000, io, zm, perf, {}, { players: {}, zombies: {} }, cm);
    expect(zombie.phase).toBe(3);
  });

  test('does not re-emit phase change if already in that phase', () => {
    const zombie = makeBossRoi({ health: 500, phase: 2 });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    updateBossRoi(zombie, 'z1', 1000, io, {}, {}, {}, { players: {}, zombies: {} }, cm);
    expect(io.emit).not.toHaveBeenCalledWith('bossPhaseChange', expect.any(Object));
  });
});
