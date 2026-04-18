/**
 * Unit tests for contexts/zombie/modules/ZombieUpdater.js
 * Focus: ability handlers + collision/damage helpers + perf helpers.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { PLAYER_SIZE: 20, ZOMBIE_SIZE: 20, ROOM_WIDTH: 1000, ROOM_HEIGHT: 1000 },
  ZOMBIE_TYPES: {
    healer:   { healCooldown: 1000, healRadius: 100, healAmount: 10 },
    slower:   { slowRadius: 150, slowDuration: 2000, slowAmount: 0.5 },
    shooter:  { shootCooldown: 1500, shootRange: 400, bulletSpeed: 5, bulletColor: '#f00' },
    poison:   { poisonTrailInterval: 500, poisonRadius: 40, poisonDamage: 5, poisonDuration: 3000, color: '#0f0' },
    berserker:{ dashSpeed: 10 },
    brute:    { chargeSpeed: 8 }
  }
}));

jest.mock('../../../../lib/MathUtils', () => ({
  fastCos: Math.cos,
  fastSin: Math.sin
}));

jest.mock('../../../../game/utilityFunctions', () => ({
  distance: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn()
}));

jest.mock('../../../../contexts/player/modules/DeathProgressionHandler', () => ({
  handlePlayerDeathProgression: jest.fn()
}));

jest.mock('../SpecialZombieUpdater', () => ({
  updateTeleporterZombie: jest.fn(),
  updateSummonerZombie: jest.fn(),
  updateBerserkerZombie: jest.fn(),
  updateNecromancerZombie: jest.fn(),
  updateBruteZombie: jest.fn(),
  updateMimicZombie: jest.fn()
}));

jest.mock('../BossUpdater', () => ({
  updateBossCharnier: jest.fn(),
  updateBossInfect: jest.fn(),
  updateBossColosse: jest.fn(),
  updateBossRoi: jest.fn(),
  updateBossOmega: jest.fn(),
  updateBossInfernal: jest.fn(),
  updateBossCryos: jest.fn(),
  updateBossVortex: jest.fn(),
  updateBossNexus: jest.fn(),
  updateBossApocalypse: jest.fn()
}));

const {
  isZombieFarFromAllPlayers,
  getNearestPlayer,
  resolveLockedTarget,
  processHealerAbility,
  processSlowerAbility,
  processShooterAbility,
  processPoisonTrail,
  calculateEffectiveSpeed,
  calculateNewPosition,
  checkPlayerCollisions,
  applyPlayerDamage,
  moveTowardsPlayer
} = require('../ZombieUpdater');

const { handlePlayerDeathProgression } = require('../../../../game/gameLoop');

describe('isZombieFarFromAllPlayers', () => {
  test('true when no live players', () => {
    expect(isZombieFarFromAllPlayers({ x: 0, y: 0 }, {})).toBe(true);
  });

  test('false when a player is within AOI rectangle', () => {
    const zombie = { x: 0, y: 0 };
    const players = { p1: { alive: true, x: 100, y: 100 } };
    expect(isZombieFarFromAllPlayers(zombie, players)).toBe(false);
  });

  test('true when players exist but all outside AOI', () => {
    const zombie = { x: 0, y: 0 };
    const players = { p1: { alive: true, x: 5000, y: 5000 } };
    expect(isZombieFarFromAllPlayers(zombie, players)).toBe(true);
  });

  test('skips dead players', () => {
    const zombie = { x: 0, y: 0 };
    const players = { p1: { alive: false, x: 100, y: 100 } };
    expect(isZombieFarFromAllPlayers(zombie, players)).toBe(true);
  });
});

describe('getNearestPlayer', () => {
  test('caches result per tick', () => {
    const zombie = { x: 0, y: 0 };
    const p1 = { alive: true, x: 10, y: 0 };
    const players = { p1 };
    const first = getNearestPlayer(zombie, players, 5);
    expect(first.player).toBe(p1);
    expect(zombie._cacheTick).toBe(5);
    // Mutating players does not affect cached result on same tick
    players.p1 = { alive: true, x: 999, y: 0 };
    const cached = getNearestPlayer(zombie, players, 5);
    expect(cached.player).toBe(p1);
  });

  test('picks closest live player', () => {
    const zombie = { x: 0, y: 0 };
    const far = { alive: true, x: 100, y: 0 };
    const near = { alive: true, x: 5, y: 0 };
    const result = getNearestPlayer(zombie, { far, near }, 1);
    expect(result.player).toBe(near);
  });

  test('returns null player when none alive', () => {
    const zombie = { x: 0, y: 0 };
    const result = getNearestPlayer(zombie, { p1: { alive: false, x: 5, y: 0 } }, 1);
    expect(result.player).toBeNull();
  });
});

describe('resolveLockedTarget', () => {
  test('returns locked player if still alive', () => {
    const zombie = { _lockedTargetId: 'p1' };
    const players = { p1: { alive: true } };
    expect(resolveLockedTarget(zombie, players)).toBe(players.p1);
  });

  test('clears lock when player dead', () => {
    const zombie = { _lockedTargetId: 'p1', _cachedNearestPlayer: {} };
    const players = { p1: { alive: false } };
    expect(resolveLockedTarget(zombie, players)).toBeNull();
    expect(zombie._lockedTargetId).toBeNull();
  });

  test('returns null when no lock set', () => {
    expect(resolveLockedTarget({}, {})).toBeNull();
  });

  test('clears lock on spawn protection / invisibility', () => {
    const zombie = { _lockedTargetId: 'p1' };
    const players = { p1: { alive: true, spawnProtection: true } };
    expect(resolveLockedTarget(zombie, players)).toBeNull();
    expect(zombie._lockedTargetId).toBeNull();
  });
});

describe('processHealerAbility', () => {
  test('type-guard', () => {
    const cm = { findZombiesInRadius: jest.fn() };
    processHealerAbility({ type: 'normal' }, 'z1', 1000, cm, {});
    expect(cm.findZombiesInRadius).not.toHaveBeenCalled();
  });

  test('heals injured zombies up to maxHealth', () => {
    const healer = { type: 'healer', x: 0, y: 0 };
    const injured = { health: 20, maxHealth: 100, x: 10, y: 0 };
    const almostFull = { health: 95, maxHealth: 100, x: 10, y: 0 };
    const cm = { findZombiesInRadius: () => [injured, almostFull] };
    processHealerAbility(healer, 'z1', 2000, cm, {});
    expect(injured.health).toBe(30);
    expect(almostFull.health).toBe(100); // capped
    expect(healer.lastHeal).toBe(2000);
  });

  test('respects heal cooldown', () => {
    const healer = { type: 'healer', x: 0, y: 0, lastHeal: 1500 };
    const cm = { findZombiesInRadius: jest.fn(() => []) };
    processHealerAbility(healer, 'z1', 2000, cm, {});
    expect(cm.findZombiesInRadius).not.toHaveBeenCalled();
  });
});

describe('processSlowerAbility', () => {
  test('applies slow status to nearby players', () => {
    const zombie = { type: 'slower', x: 0, y: 0 };
    const player = { x: 10, y: 0 };
    const cm = { findPlayersInRadius: () => [player] };
    processSlowerAbility(zombie, 1000, cm);
    expect(player.slowedUntil).toBe(3000);
    expect(player.slowAmount).toBe(0.5);
  });

  test('type-guard', () => {
    const cm = { findPlayersInRadius: jest.fn() };
    processSlowerAbility({ type: 'normal' }, 1000, cm);
    expect(cm.findPlayersInRadius).not.toHaveBeenCalled();
  });
});

describe('processShooterAbility', () => {
  test('shoots bullet at nearest cached target', () => {
    const zombie = { type: 'shooter', x: 0, y: 0, damage: 5 };
    const target = { x: 100, y: 0 };
    const cm = { findClosestPlayerCached: jest.fn(() => target) };
    const em = { createBullet: jest.fn() };
    processShooterAbility(zombie, 'z1', 2000, cm, em);
    expect(em.createBullet).toHaveBeenCalled();
    expect(zombie.lastShot).toBe(2000);
  });

  test('no-op without target', () => {
    const zombie = { type: 'shooter', x: 0, y: 0, damage: 5 };
    const cm = { findClosestPlayerCached: jest.fn(() => null) };
    const em = { createBullet: jest.fn() };
    processShooterAbility(zombie, 'z1', 2000, cm, em);
    expect(em.createBullet).not.toHaveBeenCalled();
    expect(zombie.lastShot).toBeUndefined();
  });

  test('type-guard', () => {
    const cm = { findClosestPlayerCached: jest.fn() };
    processShooterAbility({ type: 'normal' }, 'z1', 2000, cm, {});
    expect(cm.findClosestPlayerCached).not.toHaveBeenCalled();
  });
});

describe('processPoisonTrail', () => {
  test('spawns a trail entry when interval elapsed', () => {
    const zombie = { type: 'poison', x: 50, y: 50 };
    const gameState = { poisonTrails: {}, nextPoisonTrailId: 1 };
    processPoisonTrail(zombie, 1000, gameState, {});
    expect(Object.keys(gameState.poisonTrails)).toHaveLength(1);
    expect(zombie.lastPoisonTrail).toBe(1000);
  });

  test('respects interval', () => {
    const zombie = { type: 'poison', x: 50, y: 50, lastPoisonTrail: 900 };
    const gameState = { poisonTrails: {}, nextPoisonTrailId: 1 };
    processPoisonTrail(zombie, 1000, gameState, {});
    expect(Object.keys(gameState.poisonTrails)).toHaveLength(0);
  });

  test('type-guard', () => {
    const zombie = { type: 'normal' };
    const gameState = { poisonTrails: {}, nextPoisonTrailId: 1 };
    processPoisonTrail(zombie, 1000, gameState, {});
    expect(gameState.poisonTrails).toEqual({});
  });
});

describe('calculateEffectiveSpeed', () => {
  test('baseline returns zombie.speed', () => {
    expect(calculateEffectiveSpeed({ type: 'normal', speed: 5 })).toBe(5);
  });

  test('applies rage multiplier on berserker', () => {
    expect(calculateEffectiveSpeed({
      type: 'berserker', speed: 3, rageSpeedMultiplier: 2
    })).toBe(6);
  });

  test('dash overrides rage', () => {
    expect(calculateEffectiveSpeed({
      type: 'berserker', speed: 3, rageSpeedMultiplier: 2, isDashing: true
    })).toBe(10); // dashSpeed from mock
  });

  test('brute charge speed overrides base', () => {
    expect(calculateEffectiveSpeed({
      type: 'brute', speed: 2, isCharging: true
    })).toBe(8);
  });

  test('caps at MAX_SPEED=15', () => {
    expect(calculateEffectiveSpeed({
      type: 'normal', speed: 999
    })).toBe(15);
  });
});

describe('calculateNewPosition', () => {
  test('moves in angle direction scaled by speed × deltaTime', () => {
    const result = calculateNewPosition({ x: 0, y: 0 }, 0, 5, 2);
    expect(result.newX).toBeCloseTo(10);
    expect(result.newY).toBeCloseTo(0);
  });

  test('dash overrides angle with dashAngle', () => {
    const result = calculateNewPosition(
      { x: 0, y: 0, isDashing: true, dashAngle: Math.PI / 2 },
      0, // caller angle, should be overridden
      1, 1
    );
    expect(result.newY).toBeCloseTo(1);
  });

  test('charge overrides angle with chargeAngle', () => {
    const result = calculateNewPosition(
      { x: 0, y: 0, isCharging: true, chargeAngle: Math.PI },
      0, 1, 1
    );
    expect(result.newX).toBeCloseTo(-1);
  });
});

describe('applyPlayerDamage', () => {
  beforeEach(() => handlePlayerDeathProgression.mockClear());

  test('applies fractional damage scaled by DAMAGE_INTERVAL', () => {
    const zombie = { damage: 50 };
    const player = { health: 100, thorns: 0 };
    const gameState = {};
    applyPlayerDamage(zombie, 'z1', player, gameState, 1000);
    expect(player.health).toBe(95); // 50 * 0.1
  });

  test('skips when within DAMAGE_INTERVAL cooldown', () => {
    const zombie = { damage: 50 };
    const player = { health: 100, lastDamageTime: { z1: 950 } };
    applyPlayerDamage(zombie, 'z1', player, {}, 1000);
    expect(player.health).toBe(100);
  });

  test('rage multiplier increases damage', () => {
    const zombie = { type: 'berserker', damage: 50, rageDamageMultiplier: 2 };
    const player = { health: 100, thorns: 0 };
    applyPlayerDamage(zombie, 'z1', player, {}, 1000);
    expect(player.health).toBe(90); // 50 * 0.1 * 2
  });

  test('thorns reflects damage to zombie', () => {
    const zombie = { damage: 50, health: 100 };
    const player = { health: 100, thorns: 0.5 };
    applyPlayerDamage(zombie, 'z1', player, {}, 1000);
    expect(zombie.health).toBe(97.5); // 5 reflected * 0.5
  });

  test('triggers death progression on health ≤ 0', () => {
    const zombie = { damage: 2000 };
    const player = { id: 'p1', health: 10, thorns: 0 };
    applyPlayerDamage(zombie, 'z1', player, {}, 1000);
    expect(handlePlayerDeathProgression).toHaveBeenCalled();
  });
});

describe('checkPlayerCollisions', () => {
  test('damages colliding players', () => {
    const zombie = { x: 0, y: 0, size: 20, damage: 50 };
    const player = { x: 10, y: 0, health: 100, thorns: 0, dodgeChance: 0 };
    const cm = { findPlayersInRadius: () => [player] };
    checkPlayerCollisions(zombie, 'z1', cm, {}, 1000);
    expect(player.health).toBeLessThan(100);
  });

  test('skips spawn-protected players', () => {
    const zombie = { x: 0, y: 0, size: 20, damage: 50 };
    const player = { x: 10, y: 0, health: 100, spawnProtection: true };
    const cm = { findPlayersInRadius: () => [player] };
    checkPlayerCollisions(zombie, 'z1', cm, {}, 1000);
    expect(player.health).toBe(100);
  });

  test('100% dodge chance skips damage', () => {
    const zombie = { x: 0, y: 0, size: 20, damage: 50 };
    const player = { x: 10, y: 0, health: 100, dodgeChance: 1.0 };
    const cm = { findPlayersInRadius: () => [player] };
    checkPlayerCollisions(zombie, 'z1', cm, {}, 1000);
    expect(player.health).toBe(100);
  });
});

describe('moveTowardsPlayer', () => {
  test('moves zombie and triggers collision check', () => {
    const zombie = { x: 0, y: 0, size: 20, speed: 5, type: 'normal', damage: 5 };
    const target = { x: 100, y: 0 };
    const cm = { findPlayersInRadius: jest.fn(() => []) };
    moveTowardsPlayer(zombie, 'z1', target, null, cm, {}, 1000, 1);
    expect(zombie.x).toBeGreaterThan(0);
    expect(cm.findPlayersInRadius).toHaveBeenCalled();
  });

  test('sets facingAngle for shielded zombies', () => {
    const zombie = { x: 0, y: 0, size: 20, speed: 5, type: 'shielded', damage: 5 };
    const target = { x: 0, y: 100 };
    const cm = { findPlayersInRadius: () => [] };
    moveTowardsPlayer(zombie, 'z1', target, null, cm, {}, 1000, 1);
    expect(zombie.facingAngle).toBeCloseTo(Math.PI / 2);
  });
});
