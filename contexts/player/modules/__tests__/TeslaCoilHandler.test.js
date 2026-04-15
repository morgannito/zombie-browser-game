/**
 * Unit tests for contexts/player/modules/TeslaCoilHandler.js
 * Focus: cooldown gate, target selection, damage application, life steal,
 *        zombie death side-effects, no-op guards, boss wave trigger.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  WEAPONS: {
    teslaCoil: {
      fireRate: 1000,
      teslaRange: 200,
      teslaMaxTargets: 3,
      damage: 50,
      color: '#00ffff'
    }
  }
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn(),
  createLoot: jest.fn()
}));

jest.mock('../../../wave/modules/WaveManager', () => ({
  handleNewWave: jest.fn()
}));

const { updateTeslaCoil, _applyTeslaDamage } = require('../TeslaCoilHandler');
const { createParticles, createLoot } = require('../../../../game/lootFunctions');
const { handleNewWave } = require('../../../wave/modules/WaveManager');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides = {}) {
  return {
    weapon: 'teslaCoil',
    hasNickname: true,
    spawnProtection: false,
    x: 0,
    y: 0,
    lastTeslaShot: 0,
    fireRateMultiplier: 1,
    damageMultiplier: 1,
    health: 100,
    maxHealth: 100,
    kills: 0,
    zombiesKilled: 0,
    combo: 0,
    comboTimer: 0,
    ...overrides
  };
}

function makeZombie(id, overrides = {}) {
  return {
    id,
    x: 10,
    y: 10,
    health: 100,
    color: 'red',
    goldDrop: 5,
    xpDrop: 10,
    isBoss: false,
    ...overrides
  };
}

function makeGameState(zombieMap = {}) {
  return {
    zombies: { ...zombieMap },
    zombiesKilledThisWave: 0,
    mutatorEffects: {}
  };
}

function makeCollisionManager(zombiesInRange = []) {
  return {
    findZombiesInRadius: jest.fn(() => zombiesInRange)
  };
}

function makeEntityManager() {
  return {};
}

// ---------------------------------------------------------------------------
// No-op guards
// ---------------------------------------------------------------------------

describe('updateTeslaCoil no-op guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns_early_when_weapon_is_not_teslaCoil', () => {
    const player = makePlayer({ weapon: 'pistol' });
    const collision = makeCollisionManager();
    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), makeGameState(), null, null);
    expect(collision.findZombiesInRadius).not.toHaveBeenCalled();
  });

  test('returns_early_when_player_has_no_nickname', () => {
    const player = makePlayer({ hasNickname: false });
    const collision = makeCollisionManager();
    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), makeGameState(), null, null);
    expect(collision.findZombiesInRadius).not.toHaveBeenCalled();
  });

  test('returns_early_when_player_has_spawn_protection', () => {
    const player = makePlayer({ spawnProtection: true });
    const collision = makeCollisionManager();
    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), makeGameState(), null, null);
    expect(collision.findZombiesInRadius).not.toHaveBeenCalled();
  });

  test('returns_early_when_cooldown_not_elapsed', () => {
    const player = makePlayer({ lastTeslaShot: 5000 });
    const collision = makeCollisionManager();
    // now=5500, cooldown=1000 → 500 ms elapsed → not ready
    updateTeslaCoil(player, 'p1', 5500, collision, makeEntityManager(), makeGameState(), null, null);
    expect(collision.findZombiesInRadius).not.toHaveBeenCalled();
  });

  test('does_not_fire_when_no_zombies_in_range', () => {
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([]); // empty
    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), makeGameState(), null, null);
    expect(createParticles).not.toHaveBeenCalled();
    expect(player.lastTeslaShot).toBe(0); // unchanged since no targets
  });
});

// ---------------------------------------------------------------------------
// Cooldown gate
// ---------------------------------------------------------------------------

describe('updateTeslaCoil cooldown gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fires_when_cooldown_exactly_elapsed', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 1000, collision, makeEntityManager(), gameState, null, null);

    expect(createParticles).toHaveBeenCalled();
    expect(player.lastTeslaShot).toBe(1000);
  });

  test('respects_fireRateMultiplier_when_computing_cooldown', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    // fireRateMultiplier=2 → cooldown=2000
    const player = makePlayer({ lastTeslaShot: 0, fireRateMultiplier: 2 });
    const collision = makeCollisionManager([zombie]);

    // now=1500 < 2000 → should NOT fire
    updateTeslaCoil(player, 'p1', 1500, collision, makeEntityManager(), gameState, null, null);

    expect(createParticles).not.toHaveBeenCalled();
    expect(player.lastTeslaShot).toBe(0);
  });

  test('initializes_lastTeslaShot_to_zero_when_missing', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer();
    delete player.lastTeslaShot;
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 0, collision, makeEntityManager(), gameState, null, null);

    expect(player.lastTeslaShot).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Damage application
// ---------------------------------------------------------------------------

describe('updateTeslaCoil damage application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reduces_zombie_health_by_weapon_damage', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, damageMultiplier: 1 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    // weapon damage=50, multipliers=1 → health should be 150
    expect(zombie.health).toBe(150);
  });

  test('applies_player_damageMultiplier_to_damage', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, damageMultiplier: 2 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    // damage=50*2=100 → health=100
    expect(zombie.health).toBe(100);
  });

  test('applies_mutator_playerDamageMultiplier', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    gameState.mutatorEffects = { playerDamageMultiplier: 3 };
    const player = makePlayer({ lastTeslaShot: 0, damageMultiplier: 1 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    // damage=50*3=150 → health=50
    expect(zombie.health).toBe(50);
  });

  test('caps_targets_to_teslaMaxTargets', () => {
    // teslaMaxTargets=3, provide 5 zombies
    const zombies = Array.from({ length: 5 }, (_, i) => makeZombie(`z${i}`, { health: 200 }));
    const zombieMap = Object.fromEntries(zombies.map(z => [z.id, z]));
    const gameState = makeGameState(zombieMap);
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager(zombies);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    const damagedCount = zombies.filter(z => z.health < 200).length;
    expect(damagedCount).toBe(3);
  });

  test('skips_zombie_not_present_in_gameState_zombies', () => {
    const zombie = makeZombie('z1', { health: 200 });
    // gameState.zombies is empty — zombie no longer tracked
    const gameState = makeGameState({});
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(zombie.health).toBe(200); // untouched
  });
});

// ---------------------------------------------------------------------------
// Life steal
// ---------------------------------------------------------------------------

describe('updateTeslaCoil life steal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('heals_player_proportionally_to_lifeSteal_and_damage', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    // lifeSteal=0.2, damage=50 → +10 hp
    const player = makePlayer({ lastTeslaShot: 0, health: 80, maxHealth: 100, lifeSteal: 0.2 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(player.health).toBeCloseTo(90);
  });

  test('does_not_exceed_maxHealth_when_life_stealing', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, health: 99, maxHealth: 100, lifeSteal: 1 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(player.health).toBe(100);
  });

  test('no_life_steal_when_lifeSteal_property_absent', () => {
    const zombie = makeZombie('z1', { health: 200 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, health: 80 });
    delete player.lifeSteal;
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(player.health).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Zombie death side-effects
// ---------------------------------------------------------------------------

describe('updateTeslaCoil zombie death', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('removes_killed_zombie_from_gameState', () => {
    const zombie = makeZombie('z1', { health: 50 }); // exactly killed by 50 dmg
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(gameState.zombies['z1']).toBeUndefined();
  });

  test('increments_player_kills_and_zombiesKilled_on_death', () => {
    const zombie = makeZombie('z1', { health: 50 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, kills: 3, zombiesKilled: 5 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(player.kills).toBe(4);
    expect(player.zombiesKilled).toBe(6);
  });

  test('increments_player_combo_on_kill', () => {
    const zombie = makeZombie('z1', { health: 50 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, combo: 2 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(player.combo).toBe(3);
  });

  test('increments_zombiesKilledThisWave_on_death', () => {
    const zombie = makeZombie('z1', { health: 50 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(gameState.zombiesKilledThisWave).toBe(1);
  });

  test('calls_createLoot_with_zombie_drops_on_death', () => {
    const zombie = makeZombie('z1', { health: 50, goldDrop: 10, xpDrop: 20 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(createLoot).toHaveBeenCalledWith(zombie.x, zombie.y, 10, 20, gameState);
  });

  test('triggers_handleNewWave_when_boss_zombie_dies', () => {
    const zombie = makeZombie('z1', { health: 50, isBoss: true });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);
    const io = { to: jest.fn() };
    const zombieManager = {};

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, io, zombieManager);

    expect(handleNewWave).toHaveBeenCalledWith(gameState, io, zombieManager);
  });

  test('does_not_trigger_handleNewWave_when_boss_dies_without_io', () => {
    const zombie = makeZombie('z1', { health: 50, isBoss: true });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    expect(handleNewWave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Visual effects
// ---------------------------------------------------------------------------

describe('updateTeslaCoil visual effects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates_arc_particles_between_player_and_zombie', () => {
    const zombie = makeZombie('z1', { health: 200, x: 60, y: 0 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0, x: 0, y: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    // 6 arc calls (steps 0-5) + 1 impact = 7 per zombie
    expect(createParticles).toHaveBeenCalledTimes(7);
  });

  test('creates_additional_impact_particles_at_zombie_position', () => {
    const zombie = makeZombie('z1', { health: 200, x: 30, y: 40 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer({ lastTeslaShot: 0 });
    const collision = makeCollisionManager([zombie]);

    updateTeslaCoil(player, 'p1', 9999, collision, makeEntityManager(), gameState, null, null);

    // Last call should be impact at zombie coords with count=3
    const calls = createParticles.mock.calls;
    const impactCall = calls[calls.length - 1];
    expect(impactCall[0]).toBeCloseTo(zombie.x);
    expect(impactCall[1]).toBeCloseTo(zombie.y);
    expect(impactCall[3]).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// _applyTeslaDamage internal guards (lines 116-124)
// ---------------------------------------------------------------------------

describe('_applyTeslaDamage internal guards', () => {
  const teslaWeapon = { color: '#00ffff' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips_damage_when_zombie_is_null', () => {
    const player = makePlayer();
    const gameState = makeGameState({});
    // Should not throw and must not touch createParticles
    _applyTeslaDamage(null, 50, player, teslaWeapon, makeEntityManager(), gameState, 1000, null, null);
    expect(createParticles).not.toHaveBeenCalled();
  });

  test('skips_damage_when_zombie_health_is_not_a_number', () => {
    const zombie = makeZombie('z1', { health: 'corrupted' });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer();
    _applyTeslaDamage(zombie, 50, player, teslaWeapon, makeEntityManager(), gameState, 1000, null, null);
    expect(zombie.health).toBe('corrupted'); // untouched
  });

  test('skips_damage_when_damage_is_negative', () => {
    const zombie = makeZombie('z1', { health: 100 });
    const gameState = makeGameState({ z1: zombie });
    const player = makePlayer();
    _applyTeslaDamage(zombie, -10, player, teslaWeapon, makeEntityManager(), gameState, 1000, null, null);
    expect(zombie.health).toBe(100); // untouched
  });
});
