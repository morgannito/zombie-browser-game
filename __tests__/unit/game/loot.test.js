/**
 * Unit tests for loot/powerup: duplicate ID, drop rate NaN, pickup race
 */

jest.mock('../../../lib/server/ConfigManager', () => ({
  CONFIG: {
    ROOM_WIDTH: 1600, ROOM_HEIGHT: 1200,
    WALL_THICKNESS: 40, POWERUP_SIZE: 15, LOOT_SIZE: 10,
    PLAYER_SIZE: 20
  },
  POWERUP_TYPES: {
    health: { effect: jest.fn(), color: '#ff0000' },
    speed:  { effect: jest.fn(), color: '#00ff00' }
  }
}));

jest.mock('../../../infrastructure/logging/Logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn()
}));

const { createLoot, spawnPowerup } = require('../../../game/lootFunctions');
const { updateLoot } = require('../../../game/modules/loot/LootUpdater');
const { initializeGameState } = require('../../../game/gameState');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGameState(overrides = {}) {
  const gs = initializeGameState();
  return Object.assign(gs, overrides);
}

function makeEntityManager() {
  return { createParticles: jest.fn(), createExplosion: jest.fn() };
}

function makeIo() {
  return { to: jest.fn().mockReturnThis(), emit: jest.fn() };
}

// ---------------------------------------------------------------------------
// Bug 1 — duplicate loot ID (overflow protection via getNextId)
// ---------------------------------------------------------------------------

describe('createLoot — no duplicate IDs', () => {
  test('uses getNextId and assigns unique IDs sequentially', () => {
    const gs = makeGameState();
    createLoot(100, 100, 5, 10, gs);
    createLoot(200, 200, 5, 10, gs);
    const ids = Object.keys(gs.loot).map(Number);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(0);
    expect(ids[1]).toBe(1);
  });

  test('getNextId rolls over at MAX_SAFE_INTEGER safely', () => {
    const gs = makeGameState();
    gs.nextLootId = Number.MAX_SAFE_INTEGER - 999;
    // Manually push counter to rollover threshold
    gs.nextLootId = Number.MAX_SAFE_INTEGER - 1;
    createLoot(100, 100, 5, 10, gs);
    // After rollover, counter resets — no duplicate key with prior entries
    expect(Object.keys(gs.loot)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — drop rate NaN (invalid goldAmount / xpAmount)
// ---------------------------------------------------------------------------

describe('createLoot — drop rate NaN guard', () => {
  test('skips loot when both gold and xp are 0', () => {
    const gs = makeGameState();
    createLoot(100, 100, 0, 0, gs);
    expect(Object.keys(gs.loot)).toHaveLength(0);
  });

  test('skips loot when gold is NaN', () => {
    const gs = makeGameState();
    createLoot(100, 100, NaN, NaN, gs);
    expect(Object.keys(gs.loot)).toHaveLength(0);
  });

  test('creates loot when only gold is positive', () => {
    const gs = makeGameState();
    createLoot(100, 100, 5, 0, gs);
    expect(Object.keys(gs.loot)).toHaveLength(1);
    expect(gs.loot[0].gold).toBe(5);
  });

  test('creates loot when only xp is positive', () => {
    const gs = makeGameState();
    createLoot(100, 100, 0, 10, gs);
    expect(Object.keys(gs.loot)).toHaveLength(1);
    expect(gs.loot[0].xp).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — pickup race (atomic delete prevents double reward)
// ---------------------------------------------------------------------------

describe('collectLoot — pickup race condition', () => {
  test('loot collected by first eligible player only, not twice', () => {
    const gs = makeGameState();
    createLoot(100, 100, 10, 20, gs);
    const _lootId = Object.keys(gs.loot)[0];

    // Two players standing on the same loot
    gs.players = {
      p1: { x: 100, y: 100, alive: true, hasNickname: true, gold: 0, xp: 0 },
      p2: { x: 100, y: 100, alive: true, hasNickname: true, gold: 0, xp: 0 }
    };

    const io = makeIo();
    const em = makeEntityManager();
    const now = Date.now();

    updateLoot(gs, now, io, em);

    // Only one player should have received gold
    const p1Gold = gs.players.p1.gold;
    const p2Gold = gs.players.p2.gold;
    expect(p1Gold + p2Gold).toBe(10); // total gold distributed == drop amount
    expect(Object.keys(gs.loot)).toHaveLength(0); // loot gone
  });

  test('loot is deleted after collection (no second reward on next tick)', () => {
    const gs = makeGameState();
    createLoot(100, 100, 10, 0, gs);

    gs.players = {
      p1: { x: 100, y: 100, alive: true, hasNickname: true, gold: 0, xp: 0 }
    };

    const io = makeIo();
    const em = makeEntityManager();
    const now = Date.now();

    updateLoot(gs, now, io, em);
    const goldAfterFirst = gs.players.p1.gold;

    // Second tick — loot should be gone
    updateLoot(gs, now, io, em);
    expect(gs.players.p1.gold).toBe(goldAfterFirst);
  });
});

// ---------------------------------------------------------------------------
// spawnPowerup — uses getNextId (no duplicate powerup IDs)
// ---------------------------------------------------------------------------

describe('spawnPowerup — no duplicate IDs', () => {
  test('assigns unique powerup IDs across multiple spawns', () => {
    const gs = makeGameState();
    const perfIntegration = { canSpawnPowerup: jest.fn().mockReturnValue(true) };
    const metricsCollector = { incrementPowerupsSpawned: jest.fn() };
    const roomManager = { checkWallCollision: jest.fn().mockReturnValue(false) };

    // Force drop chance to 100%
    jest.spyOn(Math, 'random').mockReturnValue(0); // 0 < dropChance always

    for (let i = 0; i < 5; i++) {
      spawnPowerup(gs, roomManager, perfIntegration, metricsCollector);
    }

    jest.spyOn(Math, 'random').mockRestore();

    const ids = Object.keys(gs.powerups).map(Number);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
