/**
 * Unit tests for contexts/zombie/ZombieManager.js
 */

jest.mock('../../../lib/server/ConfigManager', () => ({
  CONFIG: {
    ROOM_WIDTH: 2000,
    ROOM_HEIGHT: 2000,
    ZOMBIE_SIZE: 20,
    WALL_THICKNESS: 20,
    MAX_ZOMBIES: 100,
    ZOMBIES_PER_ROOM: 10,
    ZOMBIE_SPAWN_INTERVAL: 1000
  },
  ZOMBIE_TYPES: {}
}));

jest.mock('../modules/ZombieSpawnManager', () => {
  return jest.fn().mockImplementation(() => ({
    selectZombieType: jest.fn(() => 'normal'),
    getBossType: jest.fn(() => 'boss')
  }));
});

jest.mock('../../../lib/runPRNG', () => ({
  runPRNG: {
    random: jest.fn(() => 0.5),
    chance: jest.fn(() => false)
  },
  resetRunPRNG: jest.fn()
}));

const ZombieManager = require('../ZombieManager');
const { runPRNG } = require('../../../lib/runPRNG');

const ZOMBIE_TYPES = {
  normal: { health: 100, damage: 10, speed: 2, gold: 5, xp: 10, color: '#ff0000', size: 20 },
  tank: { health: 400, damage: 20, speed: 1, gold: 15, xp: 30, color: '#555555', size: 30 },
  fast: { health: 60, damage: 8, speed: 4, gold: 8, xp: 12, color: '#00ff00', size: 15 },
  minion: { health: 40, damage: 5, speed: 3, gold: 2, xp: 5, color: '#aaaaaa', size: 15 },
  boss: {
    health: 2000,
    damage: 50,
    speed: 1.5,
    gold: 200,
    xp: 500,
    color: '#ff00ff',
    size: 60,
    name: 'Boss'
  },
  bossCharnier: {
    health: 3000,
    damage: 60,
    speed: 1.2,
    gold: 300,
    xp: 600,
    color: '#800080',
    size: 70,
    name: 'Charnier'
  },
  healer: { health: 80, damage: 6, speed: 2, gold: 10, xp: 15, color: '#ffffff', size: 20 },
  shooter: { health: 70, damage: 12, speed: 1.5, gold: 10, xp: 15, color: '#0000ff', size: 20 },
  poison: { health: 90, damage: 8, speed: 2, gold: 10, xp: 15, color: '#00ff88', size: 20 },
  teleporter: { health: 80, damage: 9, speed: 2, gold: 10, xp: 15, color: '#aa00ff', size: 20 },
  summoner: { health: 120, damage: 8, speed: 1.5, gold: 20, xp: 25, color: '#ff8800', size: 25 },
  shielded: { health: 150, damage: 15, speed: 1.5, gold: 20, xp: 25, color: '#88aaff', size: 25 },
  berserker: { health: 130, damage: 18, speed: 3, gold: 20, xp: 25, color: '#ff2200', size: 22 },
  necromancer: {
    health: 110,
    damage: 12,
    speed: 1.8,
    gold: 25,
    xp: 30,
    color: '#553388',
    size: 22
  },
  brute: { health: 200, damage: 22, speed: 1.2, gold: 25, xp: 30, color: '#443322', size: 28 },
  mimic: { health: 90, damage: 10, speed: 2.5, gold: 20, xp: 22, color: '#bbbbbb', size: 20 }
};

const CONFIG = {
  ROOM_WIDTH: 2000,
  ROOM_HEIGHT: 2000,
  ZOMBIE_SIZE: 20,
  WALL_THICKNESS: 20,
  MAX_ZOMBIES: 100,
  ZOMBIES_PER_ROOM: 10,
  ZOMBIE_SPAWN_INTERVAL: 1000
};

function makeGameState(overrides = {}) {
  return {
    wave: 1,
    zombies: {},
    nextZombieId: 1,
    zombiesSpawnedThisWave: 0,
    bossSpawned: false,
    mutatorEffects: {},
    ...overrides
  };
}

function noCollision() {
  return false;
}

function alwaysCollision() {
  return true;
}

// ─── constructor ──────────────────────────────────────────────────────────────

describe('ZombieManager constructor', () => {
  test('stores injected dependencies', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);

    expect(zm.gameState).toBe(gs);
    expect(zm.config).toBe(CONFIG);
    expect(zm.zombieTypes).toBe(ZOMBIE_TYPES);
    expect(zm.checkWallCollision).toBe(noCollision);
    expect(zm.io).toBeNull();
  });

  test('zombieSpawnTimer initialises to null', () => {
    const zm = new ZombieManager(makeGameState(), CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.zombieSpawnTimer).toBeNull();
  });
});

// ─── getMutatorEffect ─────────────────────────────────────────────────────────

describe('getMutatorEffect', () => {
  test('returns numeric value when key exists', () => {
    const gs = makeGameState({ mutatorEffects: { zombieHealthMultiplier: 2 } });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getMutatorEffect('zombieHealthMultiplier', 1)).toBe(2);
  });

  test('returns fallback when key is missing', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getMutatorEffect('nonExistent', 42)).toBe(42);
  });

  test('returns fallback when mutatorEffects is undefined', () => {
    const gs = makeGameState();
    gs.mutatorEffects = undefined;
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getMutatorEffect('anything', 7)).toBe(7);
  });

  test('returns fallback when value is not a number (string)', () => {
    const gs = makeGameState({ mutatorEffects: { zombieHealthMultiplier: 'strong' } });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getMutatorEffect('zombieHealthMultiplier', 1)).toBe(1);
  });
});

// ─── getZombiesPerBatch ───────────────────────────────────────────────────────

describe('getZombiesPerBatch', () => {
  function zmAtWave(wave) {
    const zm = new ZombieManager(makeGameState({ wave }), CONFIG, ZOMBIE_TYPES, noCollision);
    return zm.getZombiesPerBatch();
  }

  test('returns 2 on wave 1', () => {
    expect(zmAtWave(1)).toBe(2);
  });

  test('returns 2 on wave 2 (upper bound of bracket)', () => {
    expect(zmAtWave(2)).toBe(2);
  });

  test('returns 3 on wave 3', () => {
    expect(zmAtWave(3)).toBe(3);
  });

  test('returns 3 on wave 5', () => {
    expect(zmAtWave(5)).toBe(3);
  });

  test('returns 5 on wave 6', () => {
    expect(zmAtWave(6)).toBe(5);
  });

  test('returns 5 on wave 8', () => {
    expect(zmAtWave(8)).toBe(5);
  });

  test('returns 7 on wave 9', () => {
    expect(zmAtWave(9)).toBe(7);
  });

  test('returns 7 on wave 12', () => {
    expect(zmAtWave(12)).toBe(7);
  });

  test('returns 10 on wave 13', () => {
    expect(zmAtWave(13)).toBe(10);
  });

  test('returns 10 on very high wave', () => {
    expect(zmAtWave(200)).toBe(10);
  });
});

// ─── getSpawnInterval ─────────────────────────────────────────────────────────

describe('getSpawnInterval', () => {
  test('returns base interval on wave 1', () => {
    const zm = new ZombieManager(makeGameState({ wave: 1 }), CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getSpawnInterval()).toBe(1000);
  });

  test('reduces interval by 50ms per wave', () => {
    const zm = new ZombieManager(makeGameState({ wave: 3 }), CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getSpawnInterval()).toBe(900);
  });

  test('caps reduction at 600ms (floor at 400)', () => {
    const zm = new ZombieManager(makeGameState({ wave: 50 }), CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getSpawnInterval()).toBe(400);
  });

  test('applies spawnIntervalMultiplier when present', () => {
    const gs = makeGameState({ wave: 1, mutatorEffects: { spawnIntervalMultiplier: 0.5 } });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getSpawnInterval()).toBe(500);
  });

  test('never goes below 350 regardless of multiplier', () => {
    const gs = makeGameState({ wave: 50, mutatorEffects: { spawnIntervalMultiplier: 0.1 } });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.getSpawnInterval()).toBe(350);
  });
});

// ─── spawnSingleZombie ────────────────────────────────────────────────────────

describe('spawnSingleZombie', () => {
  test('returns false when zombie type does not exist', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, {}, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('ghost');

    const result = zm.spawnSingleZombie();

    expect(result).toBe(false);
  });

  test('returns false when all positions collide with walls', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, alwaysCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    const result = zm.spawnSingleZombie();

    expect(result).toBe(false);
  });

  test('returns true and adds zombie to gameState when position is valid', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    const result = zm.spawnSingleZombie();

    expect(result).toBe(true);
    expect(Object.keys(gs.zombies)).toHaveLength(1);
  });

  test('increments zombiesSpawnedThisWave on success', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    zm.spawnSingleZombie();

    expect(gs.zombiesSpawnedThisWave).toBe(1);
  });

  test('scales health by wave multiplier', () => {
    const gs = makeGameState({ wave: 2 });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    zm.spawnSingleZombie();

    const zombie = Object.values(gs.zombies)[0];
    // wave=2, effectiveWave=2, multiplier=1+(2-1)*0.15=1.15, normal.health=100
    expect(zombie.health).toBe(Math.floor(100 * 1.15));
  });

  test('caps effective wave at 130 for health scaling', () => {
    const gs = makeGameState({ wave: 200 });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');
    runPRNG.chance.mockReturnValue(false);

    zm.spawnSingleZombie();

    const zombie = Object.values(gs.zombies)[0];
    const multiplier = 1 + (130 - 1) * 0.15;
    expect(zombie.health).toBe(Math.floor(100 * multiplier));
  });

  test('initialises type-specific attributes for healer type', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('healer');

    zm.spawnSingleZombie();

    const zombie = Object.values(gs.zombies)[0];
    expect(zombie.lastHeal).not.toBeUndefined();
    expect(zombie.lastShot).toBeUndefined();
  });

  test('initialises type-specific attributes for shooter type', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('shooter');

    zm.spawnSingleZombie();

    const zombie = Object.values(gs.zombies)[0];
    expect(zombie.lastShot).not.toBeUndefined();
    expect(zombie.lastHeal).toBeUndefined();
  });

  test('increments nextZombieId for each spawned zombie', () => {
    const gs = makeGameState({ nextZombieId: 5 });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    zm.spawnSingleZombie();
    zm.spawnSingleZombie();

    expect(gs.nextZombieId).toBe(7);
  });

  test('zombie id matches nextZombieId pre-increment value', () => {
    const gs = makeGameState({ nextZombieId: 10 });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    zm.spawnSingleZombie();

    expect(gs.zombies[10]).toBeDefined();
    expect(gs.zombies[10].id).toBe(10);
  });

  test('applies zombieHealthMultiplier mutator', () => {
    const gs = makeGameState({ wave: 1, mutatorEffects: { zombieHealthMultiplier: 3 } });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);
    zm.spawnManager.selectZombieType.mockReturnValue('normal');

    zm.spawnSingleZombie();

    const zombie = Object.values(gs.zombies)[0];
    expect(zombie.health).toBe(Math.floor(100 * 1 * 3));
  });
});

// ─── spawnSpecificZombie ──────────────────────────────────────────────────────

describe('spawnSpecificZombie', () => {
  test('returns false for unknown type', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    expect(zm.spawnSpecificZombie('ghost', 500, 500)).toBe(false);
  });

  test('returns false when all offsets collide', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, alwaysCollision);

    expect(zm.spawnSpecificZombie('normal', 500, 500)).toBe(false);
  });

  test('spawns zombie at given coordinates when no collision', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    const result = zm.spawnSpecificZombie('tank', 500, 500);

    expect(result).toBe(true);
    const zombie = Object.values(gs.zombies)[0];
    expect(zombie.type).toBe('tank');
    expect(zombie.isSummoned).toBe(true);
  });

  test('does NOT increment zombiesSpawnedThisWave', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    zm.spawnSpecificZombie('normal', 500, 500);

    expect(gs.zombiesSpawnedThisWave).toBe(0);
  });

  test('clamps spawn coordinates within room bounds', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    zm.spawnSpecificZombie('normal', -999, 99999);

    const zombie = Object.values(gs.zombies)[0];
    expect(zombie.x).toBeGreaterThan(0);
    expect(zombie.y).toBeLessThan(CONFIG.ROOM_HEIGHT);
  });
});

// ─── spawnMinion ──────────────────────────────────────────────────────────────

describe('spawnMinion', () => {
  test('returns false when minion type not in zombieTypes', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, {}, noCollision);

    expect(zm.spawnMinion(1, 500, 500)).toBe(false);
  });

  test('returns false when all positions collide', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, alwaysCollision);

    expect(zm.spawnMinion(1, 500, 500)).toBe(false);
  });

  test('spawns minion linked to summoner id', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    const result = zm.spawnMinion(42, 500, 500);

    expect(result).toBe(true);
    const zombie = Object.values(gs.zombies)[0];
    expect(zombie.isMinion).toBe(true);
    expect(zombie.summonerId).toBe(42);
  });

  test('minion has no wave scaling applied', () => {
    const gs = makeGameState({ wave: 50 });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    zm.spawnMinion(1, 500, 500);

    const zombie = Object.values(gs.zombies)[0];
    // No wave multiplier: health should equal floor(base * healthMultiplier(1))
    expect(zombie.health).toBe(ZOMBIE_TYPES.minion.health);
  });
});

// ─── spawnBoss ────────────────────────────────────────────────────────────────

describe('spawnBoss', () => {
  test('sets bossSpawned to true', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    zm.spawnBoss();

    expect(gs.bossSpawned).toBe(true);
  });

  test('boss spawns at room center', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    zm.spawnBoss();

    const boss = Object.values(gs.zombies)[0];
    expect(boss.x).toBe(CONFIG.ROOM_WIDTH / 2);
    expect(boss.y).toBe(CONFIG.ROOM_HEIGHT / 2);
  });

  test('boss has isBoss flag set', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    zm.spawnBoss();

    const boss = Object.values(gs.zombies)[0];
    expect(boss.isBoss).toBe(true);
  });

  test('emits bossSpawned event when io provided', () => {
    const gs = makeGameState({ wave: 5 });
    const io = { emit: jest.fn() };
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, io);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    zm.spawnBoss();

    expect(io.emit).toHaveBeenCalledWith(
      'bossSpawned',
      expect.objectContaining({ bossHealth: expect.any(Number), wave: 5 })
    );
  });

  test('does not emit when io is null', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    expect(() => zm.spawnBoss()).not.toThrow();
  });

  test('boss health scales with wave multiplier (20% per wave)', () => {
    const gs = makeGameState({ wave: 2 });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    zm.spawnBoss();

    const boss = Object.values(gs.zombies)[0];
    const expected = Math.floor(ZOMBIE_TYPES.boss.health * (1 + (2 - 1) * 0.2));
    expect(boss.health).toBe(expected);
  });

  test('bossCharnier initialises lastSpawn attribute', () => {
    const gs = makeGameState();
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('bossCharnier');

    zm.spawnBoss();

    const boss = Object.values(gs.zombies)[0];
    expect(boss.lastSpawn).toBeDefined();
  });
});

// ─── spawnZombie (quota + batch logic) ───────────────────────────────────────

describe('spawnZombie', () => {
  test('does nothing when MAX_ZOMBIES already reached', () => {
    const zombies = {};
    for (let i = 0; i < CONFIG.MAX_ZOMBIES; i++) {
      zombies[i] = { id: i };
    }
    const gs = makeGameState({ zombies });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision);

    const before = Object.keys(gs.zombies).length;
    zm.spawnZombie();

    expect(Object.keys(gs.zombies).length).toBe(before);
  });

  test('spawns boss when wave quota filled and no zombies left', () => {
    const gs = makeGameState({
      wave: 1,
      zombiesSpawnedThisWave: 10,
      bossSpawned: false,
      zombies: {}
    });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);
    zm.spawnManager.getBossType.mockReturnValue('boss');

    zm.spawnZombie();

    expect(gs.bossSpawned).toBe(true);
  });

  test('does not spawn boss when zombies still alive at end of quota', () => {
    const gs = makeGameState({
      wave: 1,
      zombiesSpawnedThisWave: 10,
      bossSpawned: false,
      zombies: { 0: {} }
    });
    const zm = new ZombieManager(gs, CONFIG, ZOMBIE_TYPES, noCollision, null);

    zm.spawnZombie();

    expect(gs.bossSpawned).toBe(false);
  });
});

// ─── spawner timer controls ───────────────────────────────────────────────────

describe('stopZombieSpawner', () => {
  test('clears timer and sets it to null', () => {
    const zm = new ZombieManager(makeGameState(), CONFIG, ZOMBIE_TYPES, noCollision);
    zm.zombieSpawnTimer = setInterval(() => {}, 9999);

    zm.stopZombieSpawner();

    expect(zm.zombieSpawnTimer).toBeNull();
  });

  test('is safe to call when no timer is running', () => {
    const zm = new ZombieManager(makeGameState(), CONFIG, ZOMBIE_TYPES, noCollision);

    expect(() => zm.stopZombieSpawner()).not.toThrow();
  });
});

describe('startZombieSpawner', () => {
  afterEach(() => jest.useRealTimers());

  test('creates a timer stored in zombieSpawnTimer', () => {
    jest.useFakeTimers();
    const zm = new ZombieManager(makeGameState(), CONFIG, ZOMBIE_TYPES, noCollision);

    zm.startZombieSpawner();

    expect(zm.zombieSpawnTimer).not.toBeNull();
    clearInterval(zm.zombieSpawnTimer);
  });

  test('replaces existing timer without stacking', () => {
    jest.useFakeTimers();
    const zm = new ZombieManager(makeGameState(), CONFIG, ZOMBIE_TYPES, noCollision);
    const firstTimer = setInterval(() => {}, 9999);
    zm.zombieSpawnTimer = firstTimer;

    zm.startZombieSpawner();

    expect(zm.zombieSpawnTimer).not.toBe(firstTimer);
    clearInterval(zm.zombieSpawnTimer);
  });
});
