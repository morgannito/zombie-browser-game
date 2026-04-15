/**
 * Unit tests for contexts/zombie/modules/BossAbilities.js
 * Focus: type guards, cooldown gates, ability effects, phase transitions.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { ROOM_WIDTH: 2000, ROOM_HEIGHT: 2000, ZOMBIE_SIZE: 20 },
  ZOMBIE_TYPES: {
    bossInfernal: { color: '#ff4500' }
  }
}));

jest.mock('../../../../game/utilityFunctions', () => ({
  distance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn()
}));

const { createParticles } = require('../../../../game/lootFunctions');

const {
  updateBossInfernal,
  updateBossCryos,
  updateBossVortex,
  updateBossNexus,
  updateBossApocalypse
} = require('../BossAbilities');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntityManager() {
  return {};
}

function makeIo() {
  return { emit: jest.fn() };
}

function makeGameState({ players = {}, zombies = {}, hazardManager = null } = {}) {
  return { players, zombies, hazardManager };
}

function makePerfIntegration({ canSpawn = true } = {}) {
  return { canSpawnZombie: jest.fn(() => canSpawn) };
}

function makeZombieManager() {
  return { spawnSpecificZombie: jest.fn() };
}

function makeLivePlayer(overrides = {}) {
  return { alive: true, x: 100, y: 100, health: 200, deaths: 0, ...overrides };
}

// ---------------------------------------------------------------------------
// updateBossInfernal
// ---------------------------------------------------------------------------

describe('updateBossInfernal — type guard', () => {
  test('test_typeGuard_wrongType_noOp', () => {
    const io = makeIo();
    const gameState = makeGameState({ players: { p1: makeLivePlayer() } });

    updateBossInfernal({ type: 'normal' }, 'z1', 1000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(io.emit).not.toHaveBeenCalled();
  });

  test('test_typeGuard_missingZombieType_noOp', () => {
    const { ZOMBIE_TYPES } = require('../../../../lib/server/ConfigManager');
    const saved = ZOMBIE_TYPES.bossInfernal;
    delete ZOMBIE_TYPES.bossInfernal;

    const io = makeIo();
    updateBossInfernal({ type: 'bossInfernal', health: 100, maxHealth: 100, x: 0, y: 0 }, 'z1', 1000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), makeGameState());

    expect(io.emit).not.toHaveBeenCalled();
    ZOMBIE_TYPES.bossInfernal = saved;
  });
});

describe('updateBossInfernal — fire aura', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_fireAura_cooldownElapsed_damagesNearbyPlayer', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 50, y: 0, health: 100 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossInfernal(zombie, 'z1', 2000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.health).toBe(92);
  });

  test('test_fireAura_cooldownElapsed_setsLastAuraDamage', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100 };
    const gameState = makeGameState();

    updateBossInfernal(zombie, 'z1', 5000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(zombie.lastAuraDamage).toBe(5000);
  });

  test('test_fireAura_cooldownNotElapsed_skipsAura', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100, lastAuraDamage: 4500 };
    const player = makeLivePlayer({ x: 50, y: 0, health: 100 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossInfernal(zombie, 'z1', 5000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.health).toBe(100);
  });

  test('test_fireAura_playerTooFar_noAuraDamage', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 500, y: 0, health: 100 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossInfernal(zombie, 'z1', 2000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.health).toBe(100);
  });

  test('test_fireAura_deadPlayer_skipped', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 50, y: 0, health: 100, alive: false });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossInfernal(zombie, 'z1', 2000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.health).toBe(100);
  });

  test('test_fireAura_playerKilled_setsDeadAndIncrementsDeaths', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 50, y: 0, health: 5, deaths: 0 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossInfernal(zombie, 'z1', 2000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.alive).toBe(false);
    expect(player.deaths).toBe(1);
  });
});

describe('updateBossInfernal — meteor strike', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_meteorStrike_cooldownElapsed_emitsBossMeteor', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100, lastAuraDamage: 9999999 };
    const player = makeLivePlayer();
    const gameState = makeGameState({ players: { p1: player } });
    const io = makeIo();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    updateBossInfernal(zombie, 'z1', 9000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(io.emit).toHaveBeenCalledWith('bossMeteor', expect.objectContaining({ bossId: 'z1' }));
    Math.random.mockRestore();
  });

  test('test_meteorStrike_noAlivePlayers_returnsEarly', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100, lastAuraDamage: 9999999 };
    const player = makeLivePlayer({ alive: false });
    const gameState = makeGameState({ players: { p1: player } });
    const io = makeIo();

    updateBossInfernal(zombie, 'z1', 9000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(io.emit).not.toHaveBeenCalledWith('bossMeteor', expect.anything());
  });

  test('test_meteorStrike_hazardManagerPresent_createsMeteorHazard', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 100, maxHealth: 100, lastAuraDamage: 9999999 };
    const player = makeLivePlayer();
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ players: { p1: player }, hazardManager });
    jest.spyOn(Math, 'random').mockReturnValue(0);

    updateBossInfernal(zombie, 'z1', 9000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(hazardManager.createHazard).toHaveBeenCalledWith('meteor', expect.any(Number), expect.any(Number), 100, 60, 2000);
    Math.random.mockRestore();
  });
});

describe('updateBossInfernal — fire minions (phase 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_fireMinions_phase2_spawnsInfernoZombies', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 30, maxHealth: 100, lastAuraDamage: 9999999, lastMeteor: 9999999 };
    const gameState = makeGameState({ zombies: {} });
    const zm = makeZombieManager();
    const perf = makePerfIntegration({ canSpawn: true });
    const io = makeIo();

    updateBossInfernal(zombie, 'z1', 20000, io, zm, perf, makeEntityManager(), gameState);

    expect(zm.spawnSpecificZombie).toHaveBeenCalledWith('inferno', expect.any(Number), expect.any(Number));
    expect(zm.spawnSpecificZombie).toHaveBeenCalledTimes(5);
    expect(io.emit).toHaveBeenCalledWith('bossFireMinions', { bossId: 'z1' });
  });

  test('test_fireMinions_phase1_skipsSpawn', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 80, maxHealth: 100, lastAuraDamage: 9999999, lastMeteor: 9999999 };
    const gameState = makeGameState({ zombies: {} });
    const zm = makeZombieManager();

    updateBossInfernal(zombie, 'z1', 20000, makeIo(), zm, makePerfIntegration(), makeEntityManager(), gameState);

    expect(zm.spawnSpecificZombie).not.toHaveBeenCalled();
  });

  test('test_fireMinions_cooldownNotElapsed_skipsSpawn', () => {
    const zombie = { type: 'bossInfernal', x: 0, y: 0, health: 30, maxHealth: 100, lastAuraDamage: 9999999, lastMeteor: 9999999, lastFireMinions: 10000 };
    const gameState = makeGameState({ zombies: {} });
    const zm = makeZombieManager();

    updateBossInfernal(zombie, 'z1', 20000, makeIo(), zm, makePerfIntegration(), makeEntityManager(), gameState);

    expect(zm.spawnSpecificZombie).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateBossCryos
// ---------------------------------------------------------------------------

describe('updateBossCryos — type guard', () => {
  test('test_typeGuard_wrongType_noOp', () => {
    const io = makeIo();
    updateBossCryos({ type: 'normal' }, 'z1', 1000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), makeGameState());
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('updateBossCryos — ice spikes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_iceSpikes_cooldownElapsed_emitsBossIceSpikes', () => {
    const zombie = { type: 'bossCryos', x: 500, y: 500, health: 100, maxHealth: 100 };
    const gameState = makeGameState();
    const io = makeIo();

    updateBossCryos(zombie, 'z1', 7000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(io.emit).toHaveBeenCalledWith('bossIceSpikes', { bossId: 'z1' });
  });

  test('test_iceSpikes_hazardManagerPresent_createsIceSpikeHazards', () => {
    const zombie = { type: 'bossCryos', x: 500, y: 500, health: 100, maxHealth: 100 };
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ hazardManager });
    const io = makeIo();

    updateBossCryos(zombie, 'z1', 7000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(hazardManager.createHazard).toHaveBeenCalledWith('iceSpike', expect.any(Number), expect.any(Number), 50, 50, 3000);
    expect(hazardManager.createHazard).toHaveBeenCalledTimes(8);
  });

  test('test_iceSpikes_cooldownNotElapsed_skips', () => {
    const zombie = { type: 'bossCryos', x: 500, y: 500, health: 100, maxHealth: 100, lastSpikes: 5000 };
    const io = makeIo();

    updateBossCryos(zombie, 'z1', 7000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), makeGameState());

    expect(io.emit).not.toHaveBeenCalledWith('bossIceSpikes', expect.anything());
  });
});

describe('updateBossCryos — ice clones (phase 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_iceClones_phase2_spawnsGlacierZombies', () => {
    const zombie = { type: 'bossCryos', x: 0, y: 0, health: 60, maxHealth: 100, lastSpikes: 9999999 };
    const gameState = makeGameState({ zombies: {} });
    const zm = makeZombieManager();
    const io = makeIo();

    updateBossCryos(zombie, 'z1', 25000, io, zm, makePerfIntegration(), makeEntityManager(), gameState);

    expect(zm.spawnSpecificZombie).toHaveBeenCalledWith('glacier', expect.any(Number), expect.any(Number));
    expect(zm.spawnSpecificZombie).toHaveBeenCalledTimes(3);
    expect(io.emit).toHaveBeenCalledWith('bossIceClones', { bossId: 'z1' });
  });
});

describe('updateBossCryos — freeze aura (phase 3)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_freezeAura_phase3_slowsNearbyPlayer', () => {
    const zombie = { type: 'bossCryos', x: 0, y: 0, health: 20, maxHealth: 100, lastSpikes: 9999999, lastIceClones: 9999999 };
    const player = makeLivePlayer({ x: 50, y: 0 });
    const gameState = makeGameState({ players: { p1: player }, zombies: {} });

    updateBossCryos(zombie, 'z1', 3000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.slowedUntil).toBe(5000);
    expect(player.slowAmount).toBe(0.5);
  });

  test('test_freezeAura_phase3_playerTooFar_noSlow', () => {
    const zombie = { type: 'bossCryos', x: 0, y: 0, health: 20, maxHealth: 100, lastSpikes: 9999999, lastIceClones: 9999999 };
    const player = makeLivePlayer({ x: 500, y: 0 });
    const gameState = makeGameState({ players: { p1: player }, zombies: {} });

    updateBossCryos(zombie, 'z1', 3000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.slowedUntil).toBeUndefined();
  });
});

describe('updateBossCryos — blizzard (phase 3)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_blizzard_phase3_emitsBossBlizzard', () => {
    const zombie = { type: 'bossCryos', x: 0, y: 0, health: 20, maxHealth: 100, lastSpikes: 9999999, lastIceClones: 9999999, lastFreezeAura: 9999999 };
    const gameState = makeGameState({ zombies: {} });
    const io = makeIo();

    updateBossCryos(zombie, 'z1', 15000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(io.emit).toHaveBeenCalledWith('bossBlizzard', expect.objectContaining({ bossId: 'z1', duration: 8000 }));
  });

  test('test_blizzard_active_damagesPlayers', () => {
    const now = 15000;
    const zombie = {
      type: 'bossCryos', x: 0, y: 0, health: 20, maxHealth: 100,
      lastSpikes: 9999999, lastIceClones: 9999999, lastFreezeAura: 9999999,
      lastBlizzard: 9999999,
      blizzardActive: true,
      blizzardEnd: now + 5000
    };
    const player = makeLivePlayer({ health: 100 });
    const gameState = makeGameState({ players: { p1: player }, zombies: {} });

    updateBossCryos(zombie, 'z1', now, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(player.health).toBeCloseTo(92.5);
  });

  test('test_blizzard_expired_deactivates', () => {
    const now = 20000;
    const zombie = {
      type: 'bossCryos', x: 0, y: 0, health: 20, maxHealth: 100,
      lastSpikes: 9999999, lastIceClones: 9999999, lastFreezeAura: 9999999, lastBlizzard: 9999999,
      blizzardActive: true,
      blizzardEnd: now - 1
    };
    const gameState = makeGameState({ zombies: {} });

    updateBossCryos(zombie, 'z1', now, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState);

    expect(zombie.blizzardActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateBossVortex
// ---------------------------------------------------------------------------

describe('updateBossVortex — type guard', () => {
  test('test_typeGuard_wrongType_noOp', () => {
    const io = makeIo();
    updateBossVortex({ type: 'normal' }, 'z1', 1000, io, makeEntityManager(), makeGameState());
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('updateBossVortex — tornado pull', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_tornadoPull_cooldownElapsed_pullsNearbyPlayer', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 100 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 8000, makeIo(), makeEntityManager(), gameState);

    expect(player.x).toBeLessThan(100);
    expect(player.health).toBe(80);
  });

  test('test_tornadoPull_playerTooFar_noEffect', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 500, y: 0, health: 100 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 8000, makeIo(), makeEntityManager(), gameState);

    expect(player.health).toBe(100);
  });

  test('test_tornadoPull_deadPlayer_skipped', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 100, alive: false });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 8000, makeIo(), makeEntityManager(), gameState);

    expect(player.health).toBe(100);
  });

  test('test_tornadoPull_playerKilled_setsDeadAndIncrementsDeaths', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 100, maxHealth: 100 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 15, deaths: 0 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 8000, makeIo(), makeEntityManager(), gameState);

    expect(player.alive).toBe(false);
    expect(player.deaths).toBe(1);
  });

  test('test_tornadoPull_cooldownNotElapsed_skips', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 100, maxHealth: 100, lastTornado: 6000 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 100 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 8000, makeIo(), makeEntityManager(), gameState);

    expect(player.health).toBe(100);
  });
});

describe('updateBossVortex — lightning strikes (phase 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_lightningStrikes_phase2_createsHazards', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 60, maxHealth: 100, lastTornado: 9999999 };
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ hazardManager });
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    updateBossVortex(zombie, 'z1', 5000, makeIo(), makeEntityManager(), gameState);

    expect(hazardManager.createHazard).toHaveBeenCalledWith('lightning', expect.any(Number), expect.any(Number), 60, 40, 1000);
    expect(hazardManager.createHazard).toHaveBeenCalledTimes(6);
    Math.random.mockRestore();
  });

  test('test_lightningStrikes_phase1_skips', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 80, maxHealth: 100, lastTornado: 9999999 };
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ hazardManager });

    updateBossVortex(zombie, 'z1', 5000, makeIo(), makeEntityManager(), gameState);

    expect(hazardManager.createHazard).not.toHaveBeenCalled();
  });
});

describe('updateBossVortex — hurricane (phase 3)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_hurricane_phase3_slowsAllLivingPlayers', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 20, maxHealth: 100, lastTornado: 9999999, lastLightning: 9999999 };
    const player = makeLivePlayer();
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 3000, makeIo(), makeEntityManager(), gameState);

    expect(player.slowedUntil).toBe(4500);
    expect(player.slowAmount).toBe(0.3);
  });

  test('test_hurricane_deadPlayer_skipped', () => {
    const zombie = { type: 'bossVortex', x: 0, y: 0, health: 20, maxHealth: 100, lastTornado: 9999999, lastLightning: 9999999 };
    const player = makeLivePlayer({ alive: false });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossVortex(zombie, 'z1', 3000, makeIo(), makeEntityManager(), gameState);

    expect(player.slowedUntil).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateBossNexus
// ---------------------------------------------------------------------------

describe('updateBossNexus — type guard', () => {
  test('test_typeGuard_wrongType_noOp', () => {
    const io = makeIo();
    updateBossNexus({ type: 'normal' }, 'z1', 1000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), makeGameState(), null);
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('updateBossNexus — void rifts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_voidRifts_cooldownElapsed_createsHazard', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 100, maxHealth: 100 };
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ hazardManager });

    updateBossNexus(zombie, 'z1', 10000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(hazardManager.createHazard).toHaveBeenCalledWith('voidRift', 0, 0, 120, 45, 12000);
  });

  test('test_voidRifts_cooldownNotElapsed_skips', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 100, maxHealth: 100, lastRift: 5000 };
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ hazardManager });

    updateBossNexus(zombie, 'z1', 10000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(hazardManager.createHazard).not.toHaveBeenCalled();
  });
});

describe('updateBossNexus — teleportation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_teleport_withClosestPlayer_movesZombie', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 100, maxHealth: 100, lastRift: 9999999 };
    const player = { x: 500, y: 0 };
    const collisionManager = { findClosestPlayer: jest.fn(() => player) };
    const gameState = makeGameState();

    updateBossNexus(zombie, 'z1', 7000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, collisionManager);

    expect(zombie.x).not.toBe(0);
    expect(zombie.lastTeleport).toBe(7000);
  });

  test('test_teleport_noClosestPlayer_staysInPlace', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 100, maxHealth: 100, lastRift: 9999999 };
    const collisionManager = { findClosestPlayer: jest.fn(() => null) };
    const gameState = makeGameState();

    updateBossNexus(zombie, 'z1', 7000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, collisionManager);

    expect(zombie.x).toBe(0);
    expect(zombie.y).toBe(0);
  });

  test('test_teleport_cooldownNotElapsed_skips', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 100, maxHealth: 100, lastRift: 9999999, lastTeleport: 6000 };
    const collisionManager = { findClosestPlayer: jest.fn() };
    const gameState = makeGameState();

    updateBossNexus(zombie, 'z1', 7000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, collisionManager);

    expect(collisionManager.findClosestPlayer).not.toHaveBeenCalled();
  });
});

describe('updateBossNexus — void minions (phase 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_voidMinions_phase2_spawnsVoidAndShadow', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 60, maxHealth: 100, lastRift: 9999999, lastTeleport: 9999999 };
    const gameState = makeGameState({ zombies: {} });
    const zm = makeZombieManager();
    const io = makeIo();

    updateBossNexus(zombie, 'z1', 20000, io, zm, makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(zm.spawnSpecificZombie).toHaveBeenCalledTimes(8);
    expect(io.emit).toHaveBeenCalledWith('bossVoidMinions', { bossId: 'z1' });
  });
});

describe('updateBossNexus — reality warp (phase 3)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_realityWarp_phase3_invertsPlayerControls', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 20, maxHealth: 100, lastRift: 9999999, lastTeleport: 9999999, lastSummon: 9999999 };
    const player = makeLivePlayer();
    const gameState = makeGameState({ players: { p1: player }, zombies: {} });
    const io = makeIo();

    updateBossNexus(zombie, 'z1', 30000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.controlsInverted).toBe(true);
    expect(player.controlsInvertedUntil).toBe(35000);
    expect(io.emit).toHaveBeenCalledWith('bossRealityWarp', expect.objectContaining({ bossId: 'z1', duration: 5000 }));
  });

  test('test_realityWarp_deadPlayer_skipped', () => {
    const zombie = { type: 'bossNexus', x: 0, y: 0, health: 20, maxHealth: 100, lastRift: 9999999, lastTeleport: 9999999, lastSummon: 9999999 };
    const player = makeLivePlayer({ alive: false });
    const gameState = makeGameState({ players: { p1: player }, zombies: {} });

    updateBossNexus(zombie, 'z1', 30000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.controlsInverted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateBossApocalypse
// ---------------------------------------------------------------------------

describe('updateBossApocalypse — type guard', () => {
  test('test_typeGuard_wrongType_noOp', () => {
    const io = makeIo();
    updateBossApocalypse({ type: 'normal' }, 'z1', 1000, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), makeGameState(), null);
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('updateBossApocalypse — meteor shower', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_meteorShower_cooldownElapsed_createsHazards', () => {
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 100, maxHealth: 100 };
    const hazardManager = { createHazard: jest.fn() };
    const gameState = makeGameState({ hazardManager });
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    updateBossApocalypse(zombie, 'z1', 7000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(hazardManager.createHazard).toHaveBeenCalledWith('meteor', expect.any(Number), expect.any(Number), 100, 80, 2000);
    expect(hazardManager.createHazard).toHaveBeenCalledTimes(5);
    Math.random.mockRestore();
  });
});

describe('updateBossApocalypse — ice prison (phase 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_icePrison_phase2_freezesPlayers', () => {
    const now = 16000;
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 70, maxHealth: 100, lastMeteorShower: 9999999 };
    const player = makeLivePlayer();
    const gameState = makeGameState({ players: { p1: player } });
    const io = makeIo();

    updateBossApocalypse(zombie, 'z1', now, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.frozen).toBe(true);
    expect(player.frozenUntil).toBe(now + 3000);
    expect(io.emit).toHaveBeenCalledWith('bossIcePrison', { bossId: 'z1' });
  });

  test('test_icePrison_deadPlayer_skipped', () => {
    const now = 16000;
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 70, maxHealth: 100, lastMeteorShower: 9999999 };
    const player = makeLivePlayer({ alive: false });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossApocalypse(zombie, 'z1', now, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.frozen).toBeUndefined();
  });
});

describe('updateBossApocalypse — chain lightning (phase 3)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_chainLightning_phase3_damagesClosestPlayer', () => {
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 45, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 200 });
    const gameState = makeGameState({ players: { p1: player } });
    const collisionManager = { findClosestPlayer: jest.fn(() => player) };

    updateBossApocalypse(zombie, 'z1', 9000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, collisionManager);

    expect(player.health).toBeLessThan(200);
  });

  test('test_chainLightning_phase3_noClosestPlayer_noEffect', () => {
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 45, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999 };
    const gameState = makeGameState({ players: {} });
    const collisionManager = { findClosestPlayer: jest.fn(() => null) };

    expect(() => {
      updateBossApocalypse(zombie, 'z1', 9000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, collisionManager);
    }).not.toThrow();
  });

  test('test_chainLightning_phase2_skips', () => {
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 60, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999 };
    const gameState = makeGameState({ players: {} });
    const collisionManager = { findClosestPlayer: jest.fn() };

    updateBossApocalypse(zombie, 'z1', 9000, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, collisionManager);

    expect(collisionManager.findClosestPlayer).not.toHaveBeenCalled();
  });
});

describe('updateBossApocalypse — apocalypse ultimate (phase 4)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_apocalypseUltimate_phase4_damagesNearbyPlayers', () => {
    const now = 31000;
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 20, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999, lastChainLightning: 9999999 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 300 });
    const gameState = makeGameState({ players: { p1: player } });
    const io = makeIo();

    updateBossApocalypse(zombie, 'z1', now, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.health).toBe(100);
    expect(io.emit).toHaveBeenCalledWith('bossApocalypse', expect.objectContaining({ bossId: 'z1' }));
  });

  test('test_apocalypseUltimate_playerTooFar_noEffect', () => {
    const now = 31000;
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 20, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999, lastChainLightning: 9999999 };
    const player = makeLivePlayer({ x: 500, y: 0, health: 300 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossApocalypse(zombie, 'z1', now, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.health).toBe(300);
  });

  test('test_apocalypseUltimate_playerKilled_setsDeadAndIncrementsDeaths', () => {
    const now = 31000;
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 20, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999, lastChainLightning: 9999999 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 100, deaths: 2 });
    const gameState = makeGameState({ players: { p1: player } });

    updateBossApocalypse(zombie, 'z1', now, makeIo(), makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.alive).toBe(false);
    expect(player.deaths).toBe(3);
  });

  test('test_apocalypseUltimate_cooldownNotElapsed_skips', () => {
    const now = 31000;
    const zombie = { type: 'bossApocalypse', x: 0, y: 0, health: 20, maxHealth: 100, lastMeteorShower: 9999999, lastIcePrison: 9999999, lastChainLightning: 9999999, lastApocalypse: 20000 };
    const player = makeLivePlayer({ x: 100, y: 0, health: 300 });
    const gameState = makeGameState({ players: { p1: player } });
    const io = makeIo();

    updateBossApocalypse(zombie, 'z1', now, io, makeZombieManager(), makePerfIntegration(), makeEntityManager(), gameState, null);

    expect(player.health).toBe(300);
    expect(io.emit).not.toHaveBeenCalledWith('bossApocalypse', expect.anything());
  });
});
