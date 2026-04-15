/**
 * Unit tests for contexts/zombie/modules/SpecialZombieUpdater.js
 * Focus: per-type cooldown/gate logic, spawn/damage side-effects.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { ROOM_WIDTH: 1000, ROOM_HEIGHT: 1000, ZOMBIE_SIZE: 20 },
  ZOMBIE_TYPES: {
    teleporter: {
      color: '#abcdef',
      teleportCooldown: 1000,
      teleportRange: 400,
      teleportMinRange: 100
    },
    summoner: {
      color: '#ff00ff',
      maxMinions: 3,
      minionsPerSummon: 2,
      summonCooldown: 500
    },
    berserker: {
      color: '#ff3300',
      rageColor: '#ff0000',
      rageThreshold: 0.5,
      extremeRageThreshold: 0.2,
      rageSpeedMultiplier: 2,
      rageDamageMultiplier: 1.5,
      extremeRageSpeedMultiplier: 3,
      extremeRageDamageMultiplier: 2,
      dashCooldown: 1000,
      dashRange: 200,
      dashSpeed: 10,
      dashDuration: 300
    },
    necromancer: {
      color: '#440044',
      reviveCooldown: 1000,
      reviveRadius: 300,
      maxRevives: 2,
      reviveHealthPercent: 0.5
    },
    brute: {
      color: '#888888',
      slamCooldown: 2000,
      slamRange: 150,
      slamDamage: 25,
      slamStunDuration: 1000
    },
    mimic: {
      color: '#999999',
      transformCooldown: 3000
    },
    tank: { color: '#333', speed: 1, size: 30 },
    fast: { color: '#f00', speed: 4, size: 15 },
    healer: { color: '#0f0', speed: 2, size: 20 },
    shooter: { color: '#00f', speed: 2, size: 20 },
    slower: { color: '#0ff', speed: 1.5, size: 22 }
  }
}));

jest.mock('../../../../game/utilityFunctions', () => ({
  distance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn()
}));

const {
  updateTeleporterZombie,
  updateSummonerZombie,
  updateBerserkerZombie,
  updateNecromancerZombie,
  updateBruteZombie,
  updateMimicZombie
} = require('../SpecialZombieUpdater');

function makeCollisionManager(closest = null) {
  return { findClosestPlayer: jest.fn(() => closest) };
}

describe('updateTeleporterZombie', () => {
  test('type-guard: no-op on wrong type', () => {
    const zombie = { type: 'normal', x: 0, y: 0, size: 20 };
    const cm = makeCollisionManager({ x: 500, y: 0 });
    updateTeleporterZombie(zombie, 'z1', 1000, cm, {}, {});
    expect(cm.findClosestPlayer).not.toHaveBeenCalled();
  });

  test('skips when cooldown still active', () => {
    const zombie = { type: 'teleporter', x: 0, y: 0, size: 20, lastTeleport: 500 };
    const cm = makeCollisionManager();
    updateTeleporterZombie(zombie, 'z1', 1000, cm, {}, {});
    expect(cm.findClosestPlayer).not.toHaveBeenCalled();
  });

  test('skips teleport when player within teleportRange', () => {
    const zombie = { type: 'teleporter', x: 0, y: 0, size: 20 };
    const cm = makeCollisionManager({ x: 100, y: 0 });
    updateTeleporterZombie(zombie, 'z1', 2000, cm, {}, {});
    expect(zombie.lastTeleport).toBeUndefined();
  });

  test('teleports when player beyond range and placement valid', () => {
    const zombie = { type: 'teleporter', x: 0, y: 0, size: 20 };
    const cm = makeCollisionManager({ x: 800, y: 0 });
    const gameState = { roomManager: null };
    updateTeleporterZombie(zombie, 'z1', 2000, cm, {}, gameState);
    expect(zombie.lastTeleport).toBe(2000);
    expect(zombie.x).not.toBe(0);
  });
});

describe('updateSummonerZombie', () => {
  test('type-guard', () => {
    const zombie = { type: 'normal' };
    const zm = { spawnMinion: jest.fn() };
    updateSummonerZombie(zombie, 'z1', 1000, zm, {}, { zombies: {} });
    expect(zm.spawnMinion).not.toHaveBeenCalled();
  });

  test('spawns minions when under cap and cooldown elapsed', () => {
    const zombie = { type: 'summoner', x: 100, y: 100 };
    const zm = { spawnMinion: jest.fn(() => true) };
    const gameState = { zombies: {} };
    updateSummonerZombie(zombie, 'z1', 2000, zm, {}, gameState);
    expect(zm.spawnMinion).toHaveBeenCalledTimes(2); // minionsPerSummon
    expect(zombie.lastSummon).toBe(2000);
  });

  test('does not exceed maxMinions cap', () => {
    const zombie = { type: 'summoner', x: 0, y: 0 };
    const zm = { spawnMinion: jest.fn(() => true) };
    const gameState = {
      zombies: {
        m1: { summonerId: 'z1' },
        m2: { summonerId: 'z1' }
      }
    };
    updateSummonerZombie(zombie, 'z1', 2000, zm, {}, gameState);
    // 2 existing, cap=3, spawn ≤ min(2 per summon, cap-current)=1
    expect(zm.spawnMinion).toHaveBeenCalledTimes(1);
  });

  test('skips when cooldown active', () => {
    const zombie = { type: 'summoner', x: 0, y: 0, lastSummon: 1800 };
    const zm = { spawnMinion: jest.fn(() => true) };
    updateSummonerZombie(zombie, 'z1', 2000, zm, {}, { zombies: {} });
    expect(zm.spawnMinion).not.toHaveBeenCalled();
  });
});

describe('updateBerserkerZombie', () => {
  test('type-guard', () => {
    const zombie = { type: 'normal' };
    const cm = makeCollisionManager();
    updateBerserkerZombie(zombie, 'z1', 1000, cm, {}, {});
    expect(cm.findClosestPlayer).not.toHaveBeenCalled();
  });

  test('enters rage when health ≤ rageThreshold', () => {
    const zombie = {
      type: 'berserker', x: 0, y: 0,
      health: 30, maxHealth: 100
    };
    const cm = makeCollisionManager(null);
    updateBerserkerZombie(zombie, 'z1', 0, cm, {}, {});
    expect(zombie.isRaged).toBe(true);
    expect(zombie.rageSpeedMultiplier).toBe(2);
  });

  test('enters extreme rage when health ≤ extremeRageThreshold', () => {
    const zombie = {
      type: 'berserker', x: 0, y: 0,
      health: 15, maxHealth: 100
    };
    const cm = makeCollisionManager(null);
    updateBerserkerZombie(zombie, 'z1', 0, cm, {}, {});
    expect(zombie.isExtremeRaged).toBe(true);
    expect(zombie.rageSpeedMultiplier).toBe(3);
  });

  test('does not rage when health above threshold', () => {
    const zombie = {
      type: 'berserker', x: 0, y: 0,
      health: 80, maxHealth: 100
    };
    const cm = makeCollisionManager(null);
    updateBerserkerZombie(zombie, 'z1', 0, cm, {}, {});
    expect(zombie.isRaged).toBe(false);
    expect(zombie.rageSpeedMultiplier).toBe(1.0);
  });
});

describe('updateNecromancerZombie', () => {
  test('type-guard', () => {
    const zombie = { type: 'normal' };
    const gameState = { deadZombies: {}, zombies: {}, nextZombieId: 1 };
    updateNecromancerZombie(zombie, 'z1', 1000, {}, gameState);
    expect(gameState.zombies).toEqual({});
  });

  test('revives up to maxRevives corpses within radius', () => {
    const zombie = { type: 'necromancer', x: 100, y: 100 };
    const gameState = {
      roomManager: null,
      deadZombies: {
        c1: { x: 110, y: 100, size: 20, maxHealth: 100, speed: 2, damage: 5, goldDrop: 4, xpDrop: 4 },
        c2: { x: 120, y: 100, size: 20, maxHealth: 100, speed: 2, damage: 5, goldDrop: 4, xpDrop: 4 },
        c3: { x: 130, y: 100, size: 20, maxHealth: 100, speed: 2, damage: 5, goldDrop: 4, xpDrop: 4 },
        cFar: { x: 900, y: 900, size: 20, maxHealth: 100, speed: 2, damage: 5, goldDrop: 4, xpDrop: 4 }
      },
      zombies: {},
      nextZombieId: 1
    };
    updateNecromancerZombie(zombie, 'z1', 2000, {}, gameState);
    expect(Object.keys(gameState.zombies)).toHaveLength(2); // maxRevives
    expect(zombie.lastRevive).toBe(2000);
    expect(gameState.deadZombies.cFar).toBeDefined(); // out of radius preserved
  });

  test('skips when cooldown active', () => {
    const zombie = { type: 'necromancer', x: 0, y: 0, lastRevive: 1500 };
    const gameState = { deadZombies: {}, zombies: {}, nextZombieId: 1 };
    updateNecromancerZombie(zombie, 'z1', 2000, {}, gameState);
    expect(zombie.lastRevive).toBe(1500); // untouched
  });
});

describe('updateBruteZombie', () => {
  test('type-guard', () => {
    const zombie = { type: 'normal' };
    const cm = makeCollisionManager();
    updateBruteZombie(zombie, 'z1', 1000, cm, {}, { players: {} });
    expect(cm.findClosestPlayer).not.toHaveBeenCalled();
  });

  test('ground slam damages + stuns nearby living player', () => {
    const zombie = { type: 'brute', x: 100, y: 100 };
    const player = { alive: true, x: 110, y: 100, health: 100 };
    const gameState = { players: { p1: player } };
    const cm = makeCollisionManager(player);
    updateBruteZombie(zombie, 'z1', 3000, cm, {}, gameState);
    expect(player.health).toBe(75); // -25 slamDamage
    expect(player.stunnedUntil).toBe(3000 + 1000);
    expect(zombie.lastGroundSlam).toBe(3000);
  });

  test('skips slam when cooldown active', () => {
    const zombie = { type: 'brute', x: 100, y: 100, lastGroundSlam: 2500 };
    const cm = makeCollisionManager();
    updateBruteZombie(zombie, 'z1', 3000, cm, {}, { players: {} });
    expect(cm.findClosestPlayer).not.toHaveBeenCalled();
  });

  test('skips slam when no player in range', () => {
    const zombie = { type: 'brute', x: 0, y: 0 };
    const cm = makeCollisionManager(null);
    updateBruteZombie(zombie, 'z1', 3000, cm, {}, { players: {} });
    expect(zombie.lastGroundSlam).toBeUndefined();
  });
});

describe('updateMimicZombie', () => {
  test('type-guard', () => {
    const zombie = { type: 'normal' };
    updateMimicZombie(zombie, 'z1', 1000, {}, {}, {});
    expect(zombie.mimickedType).toBeUndefined();
  });

  test('transforms when cooldown elapsed', () => {
    const zombie = { type: 'mimic', x: 0, y: 0 };
    updateMimicZombie(zombie, 'z1', 4000, {}, {}, {});
    expect(zombie.mimickedType).toBeDefined();
    expect(zombie.lastTransform).toBe(4000);
  });

  test('skips transform when cooldown active', () => {
    const zombie = { type: 'mimic', x: 0, y: 0, lastTransform: 2000 };
    updateMimicZombie(zombie, 'z1', 4000, {}, {}, {});
    expect(zombie.mimickedType).toBeUndefined();
    expect(zombie.lastTransform).toBe(2000);
  });
});
