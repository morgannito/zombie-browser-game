/**
 * Unit tests for game/modules/zombie/ZombieEffects.js
 */

jest.mock('../../../game/lootFunctions', () => ({
  createParticles: jest.fn(),
  createLoot: jest.fn(),
  createExplosion: jest.fn()
}));

jest.mock('../../../game/modules/wave/WaveManager', () => ({
  handleNewWave: jest.fn()
}));

jest.mock('../../../game/gameLoop', () => ({
  handlePlayerDeathProgression: jest.fn()
}));

const {
  updatePoisonedZombies,
  updateFrozenSlowedZombies,
  handleSplitterDeath
} = require('../../../contexts/zombie/modules/ZombieEffects');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntityManager() {
  return { addParticle: jest.fn(), destroyBullet: jest.fn() };
}

function makeZombie(overrides = {}) {
  return {
    id: 1,
    x: 100,
    y: 100,
    color: '#ff0000',
    health: 100,
    maxHealth: 100,
    speed: 2,
    baseSpeed: 2,
    damage: 10,
    goldDrop: 5,
    xpDrop: 10,
    type: 'normal',
    ...overrides
  };
}

function makeGameState(zombies = {}) {
  return {
    zombies,
    players: {},
    nextZombieId: 100,
    deadZombies: {},
    zombiesKilledThisWave: 0
  };
}

// ---------------------------------------------------------------------------
// updatePoisonedZombies
// ---------------------------------------------------------------------------

describe('updatePoisonedZombies', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_not_poisoned_zombie_skipped_no_damage', () => {
    // Arrange
    const zombie = makeZombie({ health: 50 });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    updatePoisonedZombies(gameState, Date.now(), em);

    // Assert
    expect(zombie.health).toBe(50);
  });

  test('test_poison_expired_clears_effect', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      poisoned: { startTime: now - 6000, duration: 5000, damage: 10, lastTick: now - 6000 }
    });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    updatePoisonedZombies(gameState, now, em);

    // Assert
    expect(zombie.poisoned).toBeUndefined();
  });

  test('test_poison_tick_not_due_no_damage_applied', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      health: 80,
      poisoned: { startTime: now - 100, duration: 5000, damage: 15, lastTick: now - 100 }
    });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    updatePoisonedZombies(gameState, now, em);

    // Assert
    expect(zombie.health).toBe(80);
  });

  test('test_poison_tick_due_damage_applied', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      health: 80,
      poisoned: { startTime: now - 600, duration: 5000, damage: 15, lastTick: now - 600 }
    });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    updatePoisonedZombies(gameState, now, em);

    // Assert
    expect(zombie.health).toBe(65);
  });

  test('test_poison_kills_zombie_removes_from_gamestate', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      health: 5,
      isBoss: false,
      poisoned: { startTime: now - 600, duration: 5000, damage: 20, lastTick: now - 600 }
    });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    updatePoisonedZombies(gameState, now, em);

    // Assert
    expect(gameState.zombies[1]).toBeUndefined();
  });

  test('test_poison_tick_updates_lastTick_timestamp', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      health: 80,
      poisoned: { startTime: now - 600, duration: 5000, damage: 5, lastTick: now - 600 }
    });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    updatePoisonedZombies(gameState, now, em);

    // Assert
    expect(zombie.poisoned.lastTick).toBe(now);
  });
});

// ---------------------------------------------------------------------------
// updateFrozenSlowedZombies
// ---------------------------------------------------------------------------

describe('updateFrozenSlowedZombies', () => {
  test('test_frozen_effect_expired_restores_speed', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      speed: 0,
      frozen: { startTime: now - 4000, duration: 3000, originalSpeed: 2 }
    });
    const gameState = makeGameState({ 1: zombie });

    // Act
    updateFrozenSlowedZombies(gameState, now);

    // Assert
    expect(zombie.speed).toBe(2);
    expect(zombie.frozen).toBeUndefined();
  });

  test('test_frozen_effect_active_keeps_speed_unchanged', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      speed: 0,
      frozen: { startTime: now - 500, duration: 3000, originalSpeed: 2 }
    });
    const gameState = makeGameState({ 1: zombie });

    // Act
    updateFrozenSlowedZombies(gameState, now);

    // Assert
    expect(zombie.speed).toBe(0);
    expect(zombie.frozen).toBeDefined();
  });

  test('test_slowed_effect_expired_restores_speed', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      speed: 1,
      slowed: { endTime: now - 100, originalSpeed: 3 }
    });
    const gameState = makeGameState({ 1: zombie });

    // Act
    updateFrozenSlowedZombies(gameState, now);

    // Assert
    expect(zombie.speed).toBe(3);
    expect(zombie.slowed).toBeUndefined();
  });

  test('test_slowed_effect_active_keeps_reduced_speed', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({
      speed: 1,
      slowed: { endTime: now + 2000, originalSpeed: 3 }
    });
    const gameState = makeGameState({ 1: zombie });

    // Act
    updateFrozenSlowedZombies(gameState, now);

    // Assert
    expect(zombie.speed).toBe(1);
    expect(zombie.slowed).toBeDefined();
  });

  test('test_no_effects_zombie_untouched', () => {
    // Arrange
    const now = Date.now();
    const zombie = makeZombie({ speed: 2 });
    const gameState = makeGameState({ 1: zombie });

    // Act
    updateFrozenSlowedZombies(gameState, now);

    // Assert
    expect(zombie.speed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// handleSplitterDeath
// ---------------------------------------------------------------------------

describe('handleSplitterDeath', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_non_splitter_type_does_not_spawn_minions', () => {
    // Arrange
    const zombie = makeZombie({ type: 'normal' });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();
    const initialNextId = gameState.nextZombieId;

    // Act
    handleSplitterDeath(zombie, 1, gameState, em);

    // Assert
    expect(gameState.nextZombieId).toBe(initialNextId);
  });

  test('test_already_split_minion_does_not_recurse', () => {
    // Arrange
    const zombie = makeZombie({ type: 'splitter', isSplit: true });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();
    const initialNextId = gameState.nextZombieId;

    // Act
    handleSplitterDeath(zombie, 1, gameState, em);

    // Assert
    expect(gameState.nextZombieId).toBe(initialNextId);
  });

  test('test_splitter_death_spawns_three_minions', () => {
    // Arrange
    const zombie = makeZombie({ type: 'splitter', x: 200, y: 200 });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    handleSplitterDeath(zombie, 1, gameState, em);

    // Assert - splitCount is 3 per config
    const spawned = Object.values(gameState.zombies).filter(z => z.type === 'splitterMinion');
    expect(spawned).toHaveLength(3);
  });

  test('test_splitter_minions_are_marked_isSplit', () => {
    // Arrange
    const zombie = makeZombie({ type: 'splitter', x: 200, y: 200 });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    handleSplitterDeath(zombie, 1, gameState, em);

    // Assert
    const minions = Object.values(gameState.zombies).filter(z => z.type === 'splitterMinion');
    expect(minions.every(m => m.isSplit === true)).toBe(true);
  });

  test('test_splitter_minion_health_is_fraction_of_parent', () => {
    // Arrange
    const zombie = makeZombie({ type: 'splitter', x: 200, y: 200, maxHealth: 220 });
    const gameState = makeGameState({ 1: zombie });
    const em = makeEntityManager();

    // Act
    handleSplitterDeath(zombie, 1, gameState, em);

    // Assert - splitHealthPercent = 0.3
    const minions = Object.values(gameState.zombies).filter(z => z.type === 'splitterMinion');
    expect(minions[0].health).toBeCloseTo(220 * 0.3);
  });
});
