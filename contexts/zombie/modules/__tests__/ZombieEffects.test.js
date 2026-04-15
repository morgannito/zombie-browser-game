/**
 * Unit tests for contexts/zombie/modules/ZombieEffects.js
 * Focus: status effect lifecycle — frozen/slowed restore, poison tick, splitter death.
 */

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn(),
  createLoot: jest.fn()
}));

jest.mock('../../../../lib/server/ConfigManager', () => ({
  ZOMBIE_TYPES: {
    splitter: {
      splitCount: 3,
      splitSize: 10,
      splitColor: '#aaa',
      splitSpeedMultiplier: 1.2,
      splitHealthPercent: 0.5,
      splitDamageMultiplier: 0.5,
      splitExplosionRadius: 60,
      gold: 30,
      xp: 30,
      speed: 2
    }
  }
}));

jest.mock('../../../../game/utilityFunctions', () => ({
  distance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
}));

jest.mock('../../../../game/gameLoop', () => ({
  handlePlayerDeathProgression: jest.fn()
}));

jest.mock('../../../wave/modules/WaveManager', () => ({
  handleNewWave: jest.fn()
}));

const {
  updatePoisonTrails,
  updatePoisonedZombies,
  updateFrozenSlowedZombies,
  handleSplitterDeath
} = require('../ZombieEffects');

const { handleNewWave } = require('../../../wave/modules/WaveManager');

function makeEntityManager() {
  return {};
}

describe('updateFrozenSlowedZombies', () => {
  test('restores speed and clears frozen when duration expires', () => {
    const zombie = {
      speed: 0,
      frozen: { startTime: 0, duration: 1000, originalSpeed: 5 }
    };
    const gameState = { zombies: { z1: zombie } };
    updateFrozenSlowedZombies(gameState, 2000);
    expect(zombie.speed).toBe(5);
    expect(zombie.frozen).toBeUndefined();
  });

  test('keeps frozen active within duration', () => {
    const zombie = {
      speed: 0,
      frozen: { startTime: 500, duration: 1000, originalSpeed: 5 }
    };
    const gameState = { zombies: { z1: zombie } };
    updateFrozenSlowedZombies(gameState, 1000);
    expect(zombie.frozen).toBeDefined();
    expect(zombie.speed).toBe(0);
  });

  test('restores speed and clears slowed after endTime', () => {
    const zombie = {
      speed: 2,
      slowed: { endTime: 500, originalSpeed: 5 }
    };
    const gameState = { zombies: { z1: zombie } };
    updateFrozenSlowedZombies(gameState, 1000);
    expect(zombie.speed).toBe(5);
    expect(zombie.slowed).toBeUndefined();
  });

  test('no-op when neither effect applied', () => {
    const zombie = { speed: 5 };
    const gameState = { zombies: { z1: zombie } };
    updateFrozenSlowedZombies(gameState, 1000);
    expect(zombie.speed).toBe(5);
  });
});

describe('updatePoisonedZombies', () => {
  test('applies damage each 500ms tick', () => {
    const zombie = {
      health: 100,
      x: 0, y: 0,
      poisoned: { startTime: 0, duration: 5000, lastTick: 0, damage: 10 }
    };
    const gameState = { zombies: { z1: zombie } };
    updatePoisonedZombies(gameState, 600, makeEntityManager());
    expect(zombie.health).toBe(90);
    expect(zombie.poisoned.lastTick).toBe(600);
  });

  test('skips tick if under 500ms since last', () => {
    const zombie = {
      health: 100, x: 0, y: 0,
      poisoned: { startTime: 0, duration: 5000, lastTick: 400, damage: 10 }
    };
    const gameState = { zombies: { z1: zombie } };
    updatePoisonedZombies(gameState, 500, makeEntityManager());
    expect(zombie.health).toBe(100);
  });

  test('removes poisoned state when duration expires', () => {
    const zombie = {
      health: 100, x: 0, y: 0,
      poisoned: { startTime: 0, duration: 1000, lastTick: 500, damage: 10 }
    };
    const gameState = { zombies: { z1: zombie } };
    updatePoisonedZombies(gameState, 2000, makeEntityManager());
    expect(zombie.poisoned).toBeUndefined();
  });

  test('triggers new wave on boss poison kill', () => {
    handleNewWave.mockClear();
    const zombie = {
      health: 5, x: 0, y: 0, color: '#f00', goldDrop: 10, xpDrop: 10,
      isBoss: true,
      poisoned: { startTime: 0, duration: 5000, lastTick: 0, damage: 100 }
    };
    const gameState = { zombies: { z1: zombie }, zombiesKilledThisWave: 0 };
    const io = {};
    const zombieManager = {};
    updatePoisonedZombies(gameState, 600, makeEntityManager(), io, zombieManager);
    expect(gameState.zombies.z1).toBeUndefined();
    expect(handleNewWave).toHaveBeenCalledWith(gameState, io, zombieManager);
  });

  test('does not trigger new wave on non-boss kill', () => {
    handleNewWave.mockClear();
    const zombie = {
      health: 5, x: 0, y: 0, color: '#f00', goldDrop: 10, xpDrop: 10,
      isBoss: false,
      poisoned: { startTime: 0, duration: 5000, lastTick: 0, damage: 100 }
    };
    const gameState = { zombies: { z1: zombie }, zombiesKilledThisWave: 0 };
    updatePoisonedZombies(gameState, 600, makeEntityManager(), {}, {});
    expect(handleNewWave).not.toHaveBeenCalled();
    expect(gameState.zombiesKilledThisWave).toBe(1);
  });
});

describe('updatePoisonTrails', () => {
  function makeCM(players) {
    return { findPlayersInRadius: jest.fn(() => players) };
  }

  test('skips null trail entries', () => {
    const gameState = { poisonTrails: { t1: null } };
    const cm = makeCM([]);
    expect(() => updatePoisonTrails(gameState, 1000, cm, {})).not.toThrow();
    expect(cm.findPlayersInRadius).not.toHaveBeenCalled();
  });

  test('skips expired trails without damage processing', () => {
    const trail = { x: 0, y: 0, radius: 50, damage: 5, createdAt: 0, duration: 500 };
    const gameState = { poisonTrails: { t1: trail } };
    const cm = makeCM([{ x: 10, y: 10, health: 100 }]);
    updatePoisonTrails(gameState, 1000, cm, {});
    expect(cm.findPlayersInRadius).not.toHaveBeenCalled();
  });

  test('damages player inside trail radius', () => {
    const trail = { x: 0, y: 0, radius: 50, damage: 5, createdAt: 0, duration: 5000 };
    const player = { x: 10, y: 0, health: 100 };
    const gameState = { poisonTrails: { t1: trail } };
    const cm = makeCM([player]);
    updatePoisonTrails(gameState, 1000, cm, {});
    expect(player.health).toBe(95);
    expect(player.lastPoisonDamage.t1).toBe(1000);
  });

  test('skips spawn-protected players', () => {
    const trail = { x: 0, y: 0, radius: 50, damage: 5, createdAt: 0, duration: 5000 };
    const player = { x: 10, y: 0, health: 100, spawnProtection: true };
    const gameState = { poisonTrails: { t1: trail } };
    updatePoisonTrails(gameState, 1000, makeCM([player]), {});
    expect(player.health).toBe(100);
  });

  test('respects 500ms per-trail damage cooldown', () => {
    const trail = { x: 0, y: 0, radius: 50, damage: 5, createdAt: 0, duration: 5000 };
    const player = { x: 10, y: 0, health: 100, lastPoisonDamage: { t1: 800 } };
    const gameState = { poisonTrails: { t1: trail } };
    updatePoisonTrails(gameState, 1000, makeCM([player]), {});
    expect(player.health).toBe(100);
  });
});

describe('handleSplitterDeath', () => {
  test('no-op for non-splitter type', () => {
    const zombie = { type: 'normal', x: 0, y: 0, maxHealth: 100, damage: 10 };
    const gameState = { zombies: {}, nextZombieId: 1, players: {} };
    handleSplitterDeath(zombie, 'z1', gameState, {});
    expect(gameState.zombies).toEqual({});
  });

  test('no-op for already-split minion', () => {
    const zombie = { type: 'splitter', isSplit: true, x: 0, y: 0, maxHealth: 100, damage: 10 };
    const gameState = { zombies: {}, nextZombieId: 1, players: {} };
    handleSplitterDeath(zombie, 'z1', gameState, {});
    expect(gameState.zombies).toEqual({});
  });

  test('spawns configured number of minions around death point', () => {
    const zombie = { type: 'splitter', x: 100, y: 100, maxHealth: 100, damage: 10 };
    const gameState = { zombies: {}, nextZombieId: 1, players: {} };
    handleSplitterDeath(zombie, 'z1', gameState, {});
    expect(Object.keys(gameState.zombies)).toHaveLength(3);
    for (const id of Object.keys(gameState.zombies)) {
      expect(gameState.zombies[id].isSplit).toBe(true);
      expect(gameState.zombies[id].type).toBe('splitterMinion');
    }
  });

  test('applies explosion damage to nearby living players', () => {
    const zombie = { type: 'splitter', x: 100, y: 100, maxHealth: 100, damage: 10 };
    const player = { alive: true, x: 110, y: 100, health: 50 };
    const gameState = { zombies: {}, nextZombieId: 1, players: { p1: player } };
    handleSplitterDeath(zombie, 'z1', gameState, {});
    expect(player.health).toBe(30); // 50 - 20 explosion
  });

  test('skips invulnerable players', () => {
    const zombie = { type: 'splitter', x: 100, y: 100, maxHealth: 100, damage: 10 };
    const player = { alive: true, x: 110, y: 100, health: 50, spawnProtection: true };
    const gameState = { zombies: {}, nextZombieId: 1, players: { p1: player } };
    handleSplitterDeath(zombie, 'z1', gameState, {});
    expect(player.health).toBe(50);
  });
});
