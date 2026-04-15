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
      summonCooldown: 4000,
      cloneCooldown: 6000,
      cloneCount: 2,
      cloneHealth: 200,
      cloneDuration: 30000,
      size: 40,
      speed: 3,
      damage: 25
    },
    bossOmega: {
      color: '#ff0055',
      phase2Threshold: 0.66,
      phase3Threshold: 0.33,
      phase4Threshold: 0.10,
      abilityCooldown: 3000,
      teleportCooldown: 4000,
      toxicPoolCooldown: 5000,
      summonCooldown: 6000,
      laserCooldown: 7000,
      laserRange: 600,
      laserColor: '#ff00ff',
      laserWidth: 30,
      laserDamage: 40
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
  updateBossRoi,
  updateBossOmega
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

  test('enrage triggers when health <= threshold', () => {
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

  test('enters phase 2 when health <= phase2Threshold', () => {
    const zombie = makeBossRoi({ health: 500 }); // 50% <= 66%
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    updateBossRoi(zombie, 'z1', 1000, io, {}, {}, {}, { players: {}, zombies: {} }, cm);
    expect(zombie.phase).toBe(2);
    expect(io.emit).toHaveBeenCalledWith('bossPhaseChange', expect.objectContaining({ phase: 2 }));
  });

  test('enters phase 3 when health <= phase3Threshold', () => {
    const zombie = makeBossRoi({ health: 100 }); // 10% <= 33%
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

  test('teleport_phase2_executesWhenCooldownElapsed', () => {
    const zombie = makeBossRoi({ health: 500, phase: 2, x: 500, y: 500 });
    const io = { emit: jest.fn() };
    const player = { x: 900, y: 900 };
    const cm = { findClosestPlayer: jest.fn(() => player) };
    const gameState = { players: {}, zombies: {}, roomManager: null };
    updateBossRoi(zombie, 'z1', 9000, io, {}, {}, {}, gameState, cm);
    expect(zombie.lastTeleport).toBe(9000);
    expect(zombie.x).not.toBe(500);
  });

  test('teleport_phase2_respectsCooldown', () => {
    const zombie = makeBossRoi({ health: 500, phase: 2, x: 500, y: 500, lastTeleport: 9000 });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => ({ x: 900, y: 900 })) };
    const gameState = { players: {}, zombies: {}, roomManager: null };
    updateBossRoi(zombie, 'z1', 9001, io, {}, {}, {}, gameState, cm);
    expect(zombie.x).toBe(500);
    expect(zombie.y).toBe(500);
  });

  test('teleport_phase1_doesNotTeleport', () => {
    const zombie = makeBossRoi({ health: 1000, phase: 1, x: 500, y: 500 });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => ({ x: 900, y: 900 })) };
    const gameState = { players: {}, zombies: {}, roomManager: null };
    updateBossRoi(zombie, 'z1', 9000, io, {}, {}, {}, gameState, cm);
    expect(zombie.x).toBe(500);
    expect(cm.findClosestPlayer).not.toHaveBeenCalled();
  });

  test('teleport_noPlayer_positionUnchanged', () => {
    const zombie = makeBossRoi({ health: 500, phase: 2, x: 300, y: 300 });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    const gameState = { players: {}, zombies: {}, roomManager: null };
    updateBossRoi(zombie, 'z1', 9000, io, {}, {}, {}, gameState, cm);
    expect(zombie.x).toBe(300);
    expect(zombie.y).toBe(300);
  });

  test('summon_phase3_spawnsZombiesWhenCooldownElapsed', () => {
    const zombie = makeBossRoi({ health: 100, phase: 3, isClone: false });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    const zm = { spawnSingleZombie: jest.fn() };
    const perf = { canSpawnZombie: () => true };
    const gameState = { players: {}, zombies: {} };
    updateBossRoi(zombie, 'z1', 9000, io, zm, perf, {}, gameState, cm);
    expect(zm.spawnSingleZombie).toHaveBeenCalledTimes(5);
    expect(zombie.lastSummon).toBe(9000);
  });

  test('summon_clone_doesNotSummon', () => {
    const zombie = makeBossRoi({ health: 100, phase: 3, isClone: true });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    const zm = { spawnSingleZombie: jest.fn() };
    const perf = { canSpawnZombie: () => true };
    const gameState = { players: {}, zombies: {} };
    updateBossRoi(zombie, 'z1', 9000, io, zm, perf, {}, gameState, cm);
    expect(zm.spawnSingleZombie).not.toHaveBeenCalled();
  });

  test('clone_phase3_createsCloneEntries', () => {
    const zombie = makeBossRoi({
      health: 100, phase: 3, isClone: false,
      lastSummon: 9000
    });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    const zm = { spawnSingleZombie: jest.fn() };
    const perf = { canSpawnZombie: () => false };
    const gameState = {
      players: {}, zombies: {}, nextZombieId: 100,
      roomManager: null
    };
    updateBossRoi(zombie, 'z1', 9000, io, zm, perf, {}, gameState, cm);
    const cloneIds = Object.keys(gameState.zombies);
    expect(cloneIds).toHaveLength(2);
    expect(gameState.zombies[100].isClone).toBe(true);
    expect(io.emit).toHaveBeenCalledWith('bossClones', expect.any(Object));
  });

  test('clone_despawn_removesExpiredClone', () => {
    const zombie = makeBossRoi({ isClone: true, despawnTime: 5000 });
    const io = { emit: jest.fn() };
    const cm = { findClosestPlayer: jest.fn(() => null) };
    const gameState = { players: {}, zombies: { z1: zombie }, roomManager: null };
    updateBossRoi(zombie, 'z1', 6000, io, {}, {}, {}, gameState, cm);
    expect(gameState.zombies['z1']).toBeUndefined();
  });
});

describe('updateBossOmega', () => {
  function makeBossOmega(overrides = {}) {
    return {
      type: 'bossOmega', x: 200, y: 200,
      health: 1000, maxHealth: 1000,
      phase: 1,
      ...overrides
    };
  }

  function makeCollisionManager(player) {
    return { findClosestPlayer: jest.fn(() => player) };
  }

  test('type-guard_noOp_onWrongType', () => {
    const zombie = { type: 'normal' };
    const io = { emit: jest.fn() };
    updateBossOmega(zombie, 'z1', 1000, io, {}, {}, {}, {}, {});
    expect(io.emit).not.toHaveBeenCalled();
  });

  test('phaseChange_entersPhase2_whenHealthAtThreshold', () => {
    const zombie = makeBossOmega({ health: 600 }); // 60% <= 66%
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const gameState = { players: {}, zombies: {}, toxicPools: [] };
    updateBossOmega(zombie, 'z1', 1000, io, {}, {}, {}, gameState, cm);
    expect(zombie.phase).toBe(2);
    expect(io.emit).toHaveBeenCalledWith('bossPhaseChange', expect.objectContaining({ phase: 2 }));
  });

  test('phaseChange_entersPhase3_whenHealthAtThreshold', () => {
    const zombie = makeBossOmega({ health: 250, phase: 2 }); // 25% <= 33%
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 1000, io, {}, { canSpawnZombie: () => false }, {}, gameState, cm);
    expect(zombie.phase).toBe(3);
  });

  test('phaseChange_entersPhase4_whenHealthAtThreshold', () => {
    const zombie = makeBossOmega({ health: 50, phase: 3 }); // 5% <= 10%
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 1000, io, {}, { canSpawnZombie: () => false }, {}, gameState, cm);
    expect(zombie.phase).toBe(4);
    expect(io.emit).toHaveBeenCalledWith('bossPhaseChange', expect.objectContaining({ phase: 4 }));
  });

  test('phaseChange_noReEmit_whenAlreadyInPhase', () => {
    const zombie = makeBossOmega({ health: 600, phase: 2 });
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 1000, io, {}, {}, {}, gameState, cm);
    expect(io.emit).not.toHaveBeenCalledWith('bossPhaseChange', expect.any(Object));
  });

  test('teleport_allPhases_executesWhenCooldownElapsed', () => {
    const zombie = makeBossOmega({ x: 400, y: 400 });
    const io = { emit: jest.fn() };
    const player = { x: 800, y: 800 };
    const cm = makeCollisionManager(player);
    const gameState = { players: {}, zombies: {}, roomManager: null };
    updateBossOmega(zombie, 'z1', 5000, io, {}, {}, {}, gameState, cm);
    expect(zombie.lastTeleport).toBe(5000);
    expect(zombie.x).not.toBe(400);
  });

  test('teleport_respectsCooldown', () => {
    const zombie = makeBossOmega({ x: 400, y: 400, lastTeleport: 5000 });
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager({ x: 800, y: 800 });
    const gameState = { players: {}, zombies: {}, roomManager: null };
    updateBossOmega(zombie, 'z1', 5001, io, {}, {}, {}, gameState, cm);
    expect(zombie.x).toBe(400);
    expect(zombie.y).toBe(400);
  });

  test('toxicPool_phase2_createsPoolEntry', () => {
    const zombie = makeBossOmega({ health: 600, phase: 2, lastTeleport: 5000 });
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 5001, io, {}, {}, {}, gameState, cm);
    expect(gameState.toxicPools).toHaveLength(1);
    expect(gameState.toxicPools[0].x).toBe(zombie.x);
    expect(zombie.lastToxicPool).toBe(5001);
  });

  test('toxicPool_phase1_doesNotCreatePool', () => {
    const zombie = makeBossOmega({ health: 1000, phase: 1, lastTeleport: 5000 });
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 5001, io, {}, {}, {}, gameState, cm);
    expect(gameState.toxicPools).toBeUndefined();
  });

  test('summon_phase3_spawnsZombies', () => {
    const zombie = makeBossOmega({
      health: 250, phase: 3,
      lastTeleport: 5000, lastToxicPool: 5001
    });
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager(null);
    const zm = { spawnSingleZombie: jest.fn() };
    const perf = { canSpawnZombie: () => true };
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 5002, io, zm, perf, {}, gameState, cm);
    expect(zm.spawnSingleZombie).toHaveBeenCalledTimes(8);
    expect(zombie.lastSummon).toBe(5002);
  });

  test('laser_phase4_emitsLaserEvent', () => {
    const zombie = makeBossOmega({
      health: 50, phase: 4,
      lastTeleport: 8000, lastToxicPool: 8000, lastSummon: 8000
    });
    const io = { emit: jest.fn() };
    const player = { alive: true, x: 700, y: 200 };
    const cm = makeCollisionManager(player);
    const gameState = { players: { p1: player }, zombies: {} };
    updateBossOmega(zombie, 'z1', 9000, io, {}, {}, {}, gameState, cm);
    expect(zombie.lastLaser).toBe(9000);
    expect(io.emit).toHaveBeenCalledWith('bossLaser', expect.objectContaining({
      bossId: 'z1',
      angle: expect.any(Number)
    }));
  });

  test('laser_phase4_damagesPlayerInBeam', () => {
    const zombie = makeBossOmega({
      health: 50, phase: 4,
      lastTeleport: 8000, lastToxicPool: 8000, lastSummon: 8000,
      x: 200, y: 200
    });
    const io = { emit: jest.fn() };
    // Player on exact horizontal line — angle diff = 0
    const player = {
      alive: true, spawnProtection: false, invisible: false,
      x: 400, y: 200, health: 200
    };
    const cm = makeCollisionManager(player);
    const gameState = { players: { p1: player }, zombies: {} };
    updateBossOmega(zombie, 'z1', 9000, io, {}, {}, {}, gameState, cm);
    expect(player.health).toBeLessThan(200);
  });

  test('laser_phase3_doesNotFire', () => {
    const zombie = makeBossOmega({
      health: 250, phase: 3,
      lastTeleport: 8000, lastToxicPool: 8000, lastSummon: 8000
    });
    const io = { emit: jest.fn() };
    const cm = makeCollisionManager({ x: 700, y: 200 });
    const perf = { canSpawnZombie: () => false };
    const gameState = { players: {}, zombies: {} };
    updateBossOmega(zombie, 'z1', 9000, io, { spawnSingleZombie: jest.fn() }, perf, {}, gameState, cm);
    expect(io.emit).not.toHaveBeenCalledWith('bossLaser', expect.any(Object));
  });
});
