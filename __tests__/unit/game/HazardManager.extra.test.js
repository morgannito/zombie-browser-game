/**
 * Unit tests — HazardManager (additional paths)
 *
 * Focuses on: multi-hazard cleanup, toxic pool damage rate, player death from hazard,
 * null gameState arrays, createHazard with custom damageInterval, clearAll idempotence.
 */

'use strict';

const HazardManager = require('../../../game/modules/hazards/HazardManager');

function makePlayer(overrides = {}) {
  return {
    alive: true,
    x: 100,
    y: 100,
    health: 100,
    maxHealth: 200,
    spawnProtection: false,
    invisible: false,
    deaths: 0,
    ...overrides
  };
}

function makeEntityManager() {
  return { createParticle: jest.fn(), createParticles: jest.fn() };
}

function makeGameState(overrides = {}) {
  return {
    hazards: [],
    toxicPools: [],
    players: { p1: makePlayer() },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe('HazardManager — initialize', () => {
  test('test_initialize_withExistingHazards_doesNotOverwrite', () => {
    // Arrange
    const gs = { players: {}, hazards: [{ id: 'existing' }], toxicPools: [] };
    const hm = new HazardManager(gs, makeEntityManager());

    // Act
    hm.initialize();

    // Assert
    expect(gs.hazards).toHaveLength(1);
  });

  test('test_initialize_missingHazards_createsEmptyArray', () => {
    // Arrange
    const gs = { players: {}, toxicPools: [] };
    const hm = new HazardManager(gs, makeEntityManager());

    // Act
    hm.initialize();

    // Assert
    expect(gs.hazards).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateHazards — multi-hazard, mixed expiry
// ---------------------------------------------------------------------------

describe('HazardManager — updateHazards mixed expiry', () => {
  test('test_updateHazards_mixedExpiry_onlyRemovesExpired', () => {
    // Arrange
    const gs = makeGameState({
      players: { p1: makePlayer({ x: 999, y: 999 }) } // out of range
    });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.hazards.push(
      { type: 'meteor', x: 0, y: 0, radius: 10, damage: 5, createdAt: now - 5000, duration: 2000 },
      { type: 'meteor', x: 0, y: 0, radius: 10, damage: 5, createdAt: now, duration: 3000 }
    );

    // Act
    hm.updateHazards(now);

    // Assert
    expect(gs.hazards).toHaveLength(1);
    expect(gs.hazards[0].createdAt).toBe(now);
  });

  test('test_updateHazards_allExpired_arrayBecomesEmpty', () => {
    // Arrange
    const gs = makeGameState({ players: {} });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.hazards.push(
      { type: 'meteor', x: 0, y: 0, radius: 1, damage: 1, createdAt: now - 9000, duration: 1000 },
      { type: 'lavaPool', x: 0, y: 0, radius: 1, damage: 1, createdAt: now - 9000, duration: 1000 }
    );

    // Act
    hm.updateHazards(now);

    // Assert
    expect(gs.hazards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateHazards — player killed by hazard
// ---------------------------------------------------------------------------

describe('HazardManager — hazard kills player', () => {
  test('test_updateHazards_playerHealthReachesZero_deathIncremented', () => {
    // Arrange
    const gs = makeGameState({
      players: { p1: makePlayer({ health: 5 }) }
    });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.hazards.push({
      type: 'meteor',
      x: 100,
      y: 100,
      radius: 200,
      damage: 50,
      createdAt: now,
      duration: 5000,
      damageInterval: 0
    });

    // Act
    hm.updateHazards(now);

    // Assert
    expect(gs.players.p1.alive).toBe(false);
    expect(gs.players.p1.deaths).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updateToxicPools — damage rate (half per tick)
// ---------------------------------------------------------------------------

describe('HazardManager — toxic pool damage rate', () => {
  test('test_updateToxicPools_playerInRange_takesHalfDamagePerTick', () => {
    // Arrange
    const gs = makeGameState({
      players: { p1: makePlayer({ health: 100 }) }
    });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.toxicPools.push({
      id: 'pool1',
      x: 100,
      y: 100,
      radius: 200,
      damage: 40,
      createdAt: now,
      duration: 10000,
      lastDamageTick: null
    });

    // Act
    hm.updateToxicPools(now);

    // Assert: damage = pool.damage / 2 = 20
    expect(gs.players.p1.health).toBe(80);
  });

  test('test_updateToxicPools_playerOutOfRange_noDamage', () => {
    // Arrange
    const gs = makeGameState({
      players: { p1: makePlayer({ x: 900, y: 900, health: 100 }) }
    });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.toxicPools.push({
      id: 'pool1',
      x: 100,
      y: 100,
      radius: 50,
      damage: 40,
      createdAt: now,
      duration: 10000
    });

    // Act
    hm.updateToxicPools(now);

    // Assert
    expect(gs.players.p1.health).toBe(100);
  });

  test('test_updateToxicPools_cooldownNotElapsed_noDuplicateDamage', () => {
    // Arrange
    const gs = makeGameState({
      players: { p1: makePlayer({ health: 100 }) }
    });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.toxicPools.push({
      id: 'pool1',
      x: 100,
      y: 100,
      radius: 200,
      damage: 40,
      createdAt: now,
      duration: 10000,
      lastDamageTick: now // already ticked this ms
    });

    // Act
    hm.updateToxicPools(now);

    // Assert — cooldown not elapsed (need 500ms), no new damage
    expect(gs.players.p1.health).toBe(100);
  });

  test('test_updateToxicPools_expired_removedFromArray', () => {
    // Arrange
    const gs = makeGameState({ players: {} });
    const hm = new HazardManager(gs, makeEntityManager());
    const now = Date.now();

    gs.toxicPools.push({
      id: 'pool1',
      x: 0,
      y: 0,
      radius: 10,
      damage: 5,
      createdAt: now - 5000,
      duration: 3000
    });

    // Act
    hm.updateToxicPools(now);

    // Assert
    expect(gs.toxicPools).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// update (delegates both)
// ---------------------------------------------------------------------------

describe('HazardManager — update delegates', () => {
  test('test_update_noHazards_doesNotThrow', () => {
    // Arrange
    const gs = makeGameState({ hazards: [], toxicPools: [] });
    const hm = new HazardManager(gs, makeEntityManager());

    // Act + Assert
    expect(() => hm.update(Date.now())).not.toThrow();
  });

  test('test_update_withNullHazards_doesNotThrow', () => {
    // Arrange
    const gs = makeGameState({ hazards: null, toxicPools: null });
    const hm = new HazardManager(gs, makeEntityManager());

    // Act + Assert
    expect(() => hm.update(Date.now())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// clearAll — idempotence
// ---------------------------------------------------------------------------

describe('HazardManager — clearAll', () => {
  test('test_clearAll_twice_doesNotThrow', () => {
    // Arrange
    const gs = makeGameState();
    const hm = new HazardManager(gs, makeEntityManager());

    // Act + Assert
    hm.clearAll();
    expect(() => hm.clearAll()).not.toThrow();
  });

  test('test_clearAll_withPools_bothArraysEmpty', () => {
    // Arrange
    const gs = makeGameState();
    const hm = new HazardManager(gs, makeEntityManager());
    gs.hazards.push({ type: 'meteor' });
    gs.toxicPools.push({ id: 'p1' });

    // Act
    hm.clearAll();

    // Assert
    expect(gs.hazards).toHaveLength(0);
    expect(gs.toxicPools).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getCount
// ---------------------------------------------------------------------------

describe('HazardManager — getCount', () => {
  test('test_getCount_mixed_returnsCorrectTotals', () => {
    // Arrange
    const gs = makeGameState();
    const hm = new HazardManager(gs, makeEntityManager());
    gs.hazards.push({ type: 'meteor' }, { type: 'lavaPool' });
    gs.toxicPools.push({ id: 'p1' });

    // Act
    const result = hm.getCount();

    // Assert
    expect(result.hazards).toBe(2);
    expect(result.pools).toBe(1);
    expect(result.total).toBe(3);
  });

  test('test_getCount_empty_returnsZeros', () => {
    // Arrange
    const gs = makeGameState();
    const hm = new HazardManager(gs, makeEntityManager());

    // Act
    const result = hm.getCount();

    // Assert
    expect(result.total).toBe(0);
  });
});
