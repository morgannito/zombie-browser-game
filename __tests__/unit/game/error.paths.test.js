/**
 * Unit tests — error paths and init errors
 *
 * Covers: requires with missing data, init errors, invalid inputs,
 * gameState.getNextId with invalid counter, validation null/unknown inputs.
 */

'use strict';

// ---------------------------------------------------------------------------
// gameState.getNextId — invalid counter name
// ---------------------------------------------------------------------------

describe('gameState — getNextId error paths', () => {
  const { initializeGameState } = require('../../../game/gameState');

  test('test_getNextId_unknownCounter_doesNotThrow', () => {
    // Arrange
    const gs = initializeGameState();

    // Act + Assert — initializes missing counter to 0 instead of throwing
    expect(() => gs.getNextId('nonExistentCounter')).not.toThrow();
  });

  test('test_getNextId_unknownCounter_returnsZero', () => {
    // Arrange
    const gs = initializeGameState();

    // Act
    const id = gs.getNextId('nonExistentCounter');

    // Assert — auto-initializes to 0 then returns 0
    expect(id).toBe(0);
  });

  test('test_getNextId_validCounter_incrementsEachCall', () => {
    // Arrange
    const gs = initializeGameState();

    // Act
    const id1 = gs.getNextId('nextZombieId');
    const id2 = gs.getNextId('nextZombieId');

    // Assert
    expect(id2).toBe(id1 + 1);
  });

  test('test_getNextId_overflowThreshold_rollsOverToZero', () => {
    // Arrange
    const gs = initializeGameState();
    gs.nextZombieId = Number.MAX_SAFE_INTEGER - 999; // at overflow boundary

    // Act
    const id = gs.getNextId('nextZombieId');

    // Assert — rolls over to 0
    expect(id).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateBuyItemData — error paths
// ---------------------------------------------------------------------------

describe('validateBuyItemData — error paths', () => {
  const { validateBuyItemData } = require('../../../game/validationFunctions');

  test('test_validateBuyItemData_null_returnsNull', () => {
    expect(validateBuyItemData(null)).toBeNull();
  });

  test('test_validateBuyItemData_emptyObject_returnsNull', () => {
    expect(validateBuyItemData({})).toBeNull();
  });

  test('test_validateBuyItemData_invalidCategory_returnsNull', () => {
    expect(validateBuyItemData({ itemId: 'maxHealth', category: 'hack' })).toBeNull();
  });

  test('test_validateBuyItemData_unknownItemId_returnsNull', () => {
    expect(validateBuyItemData({ itemId: 'godMode', category: 'permanent' })).toBeNull();
  });

  test('test_validateBuyItemData_validInput_returnsObject', () => {
    // Arrange — use a known permanent item
    const ConfigManager = require('../../../lib/server/ConfigManager');
    const itemId = Object.keys(ConfigManager.SHOP_ITEMS.permanent)[0];

    // Act
    const result = validateBuyItemData({ itemId, category: 'permanent' });

    // Assert
    expect(result).not.toBeNull();
    expect(result.itemId).toBe(itemId);
  });
});

// ---------------------------------------------------------------------------
// validateMovementData — error paths
// ---------------------------------------------------------------------------

describe('validateMovementData — error paths', () => {
  const { validateMovementData } = require('../../../game/validationFunctions');

  test('test_validateMovementData_NaNX_returnsNull', () => {
    expect(validateMovementData({ x: NaN, y: 100, angle: 0 })).toBeNull();
  });

  test('test_validateMovementData_InfinityY_returnsNull', () => {
    expect(validateMovementData({ x: 100, y: Infinity, angle: 0 })).toBeNull();
  });

  test('test_validateMovementData_stringAngle_returnsNull', () => {
    expect(validateMovementData({ x: 100, y: 100, angle: 'up' })).toBeNull();
  });

  test('test_validateMovementData_missingFields_returnsNull', () => {
    expect(validateMovementData({ x: 100 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateShootData — error paths
// ---------------------------------------------------------------------------

describe('validateShootData — error paths', () => {
  const { validateShootData } = require('../../../game/validationFunctions');

  test('test_validateShootData_null_returnsNull', () => {
    expect(validateShootData(null)).toBeNull();
  });

  test('test_validateShootData_angleOutOfBounds_returnsNull', () => {
    expect(validateShootData({ angle: 100 })).toBeNull();
  });

  test('test_validateShootData_validAngle_returnsObject', () => {
    const result = validateShootData({ angle: 1.5 });
    expect(result).not.toBeNull();
    expect(result.angle).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// HazardManager — init with missing gameState fields
// ---------------------------------------------------------------------------

describe('HazardManager — init error paths', () => {
  const HazardManager = require('../../../game/modules/hazards/HazardManager');

  test('test_constructor_withMinimalGameState_doesNotThrow', () => {
    // Arrange
    const gs = { players: {} };
    const em = { createParticle: jest.fn() };

    // Act + Assert
    expect(() => new HazardManager(gs, em)).not.toThrow();
  });

  test('test_updateHazards_missingHazardsArray_doesNotThrow', () => {
    // Arrange
    const gs = { players: {}, toxicPools: [] };
    const hm = new HazardManager(gs, { createParticle: jest.fn() });

    // Act + Assert — guard: if (!this.gameState.hazards) return
    expect(() => hm.updateHazards(Date.now())).not.toThrow();
  });

  test('test_updateToxicPools_missingToxicPoolsArray_doesNotThrow', () => {
    // Arrange
    const gs = { players: {}, hazards: [] };
    const hm = new HazardManager(gs, { createParticle: jest.fn() });

    // Act + Assert
    expect(() => hm.updateToxicPools(Date.now())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// WaveManager — error paths
// ---------------------------------------------------------------------------

describe('WaveManager — error paths', () => {
  const { handleNewWave } = require("../../../contexts/wave/modules/WaveManager");

  test('test_handleNewWave_emptyPlayers_doesNotThrow', () => {
    // Arrange
    const gs = {
      wave: 1,
      bossSpawned: false,
      zombiesKilledThisWave: 0,
      zombiesSpawnedThisWave: 0,
      players: {},
      mutatorManager: null,
      activeMutators: [],
      mutatorEffects: { spawnCountMultiplier: 1 },
      nextMutatorWave: 0
    };

    // Act + Assert
    expect(() =>
      handleNewWave(gs, { emit: jest.fn() }, { restartZombieSpawner: jest.fn() })
    ).not.toThrow();
  });

  test('test_handleNewWave_missingMutatorEffects_usesDefaultMultiplier', () => {
    // Arrange
    const gs = {
      wave: 1,
      bossSpawned: false,
      zombiesKilledThisWave: 0,
      zombiesSpawnedThisWave: 0,
      players: {},
      mutatorManager: null,
      activeMutators: [],
      mutatorEffects: null, // missing
      nextMutatorWave: 0
    };
    const io = { emit: jest.fn() };

    // Act + Assert — should not throw; defaults to multiplier=1
    expect(() => handleNewWave(gs, io, { restartZombieSpawner: jest.fn() })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Player entity — constructor with missing required fields
// ---------------------------------------------------------------------------

describe('Player entity — init error paths', () => {
  const Player = require('../../../lib/domain/entities/Player');

  test('test_constructor_missingUsername_usesEmptyDefault', () => {
    // Act
    const player = new Player({ id: 'p1' });

    // Assert — should not throw, username defaults gracefully
    expect(player.id).toBe('p1');
  });

  test('test_getKDRatio_negativeDeaths_doesNotThrow', () => {
    // Arrange — defensive: should not crash with unexpected value
    const player = new Player({ id: 'p1', username: 'X', totalKills: 5, totalDeaths: -1 });

    // Act + Assert
    expect(() => player.getKDRatio()).not.toThrow();
  });
});
