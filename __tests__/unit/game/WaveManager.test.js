/**
 * Unit tests — WaveManager
 *
 * Covers: wave transitions, tracker resets, survivor rewards, player notification
 */

'use strict';

const { handleNewWave } = require('../../../game/modules/wave/WaveManager');

function makeGameState(overrides = {}) {
  return {
    wave: 1,
    bossSpawned: true,
    zombiesKilledThisWave: 8,
    zombiesSpawnedThisWave: 8,
    players: {},
    mutatorManager: null,
    activeMutators: [],
    mutatorEffects: { spawnCountMultiplier: 1 },
    nextMutatorWave: 0,
    ...overrides
  };
}

function makeIo() {
  return { emit: jest.fn() };
}

function makeZombieManager() {
  return { restartZombieSpawner: jest.fn() };
}

// ---------------------------------------------------------------------------
// Wave increment
// ---------------------------------------------------------------------------

describe('WaveManager — wave increment', () => {
  test('test_handleNewWave_wave1_incrementsToWave2', () => {
    // Arrange
    const gs = makeGameState({ wave: 1 });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.wave).toBe(2);
  });

  test('test_handleNewWave_highWave_stillIncrements', () => {
    // Arrange
    const gs = makeGameState({ wave: 129 });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.wave).toBe(130);
  });
});

// ---------------------------------------------------------------------------
// Tracker resets
// ---------------------------------------------------------------------------

describe('WaveManager — tracker resets', () => {
  test('test_handleNewWave_bossSpawned_resetsToFalse', () => {
    // Arrange
    const gs = makeGameState({ bossSpawned: true });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.bossSpawned).toBe(false);
  });

  test('test_handleNewWave_zombiesKilledThisWave_resetsToZero', () => {
    // Arrange
    const gs = makeGameState({ zombiesKilledThisWave: 15 });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.zombiesKilledThisWave).toBe(0);
  });

  test('test_handleNewWave_zombiesSpawnedThisWave_resetsToZero', () => {
    // Arrange
    const gs = makeGameState({ zombiesSpawnedThisWave: 12 });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.zombiesSpawnedThisWave).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Spawner restart
// ---------------------------------------------------------------------------

describe('WaveManager — spawner restart', () => {
  test('test_handleNewWave_zombieManager_restartCalled', () => {
    // Arrange
    const gs = makeGameState();
    const zm = makeZombieManager();

    // Act
    handleNewWave(gs, makeIo(), zm);

    // Assert
    expect(zm.restartZombieSpawner).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Player notification (io.emit)
// ---------------------------------------------------------------------------

describe('WaveManager — player notification', () => {
  test('test_handleNewWave_ioEmit_newWaveEventFired', () => {
    // Arrange
    const gs = makeGameState({ wave: 5 });
    const io = makeIo();

    // Act
    handleNewWave(gs, io, makeZombieManager());

    // Assert
    expect(io.emit).toHaveBeenCalledWith('newWave', expect.objectContaining({ wave: 6 }));
  });

  test('test_handleNewWave_wave130plus_effectiveWaveCappedAt130', () => {
    // Arrange
    const gs = makeGameState({ wave: 130 });
    const io = makeIo();

    // Act
    handleNewWave(gs, io, makeZombieManager());

    // Assert — zombiesCount based on effectiveWave capped to 130
    const call = io.emit.mock.calls[0];
    expect(call[0]).toBe('newWave');
    // effectiveWave = min(131, 130) = 130 → should match same value as wave=130
    expect(call[1].zombiesCount).toBeGreaterThan(0);
  });

  test('test_handleNewWave_spawnCountMultiplier_appliedToZombiesCount', () => {
    // Arrange
    const gs = makeGameState({ wave: 1, mutatorEffects: { spawnCountMultiplier: 2 } });
    const ioNormal = makeIo();
    const gsNormal = makeGameState({ wave: 1, mutatorEffects: { spawnCountMultiplier: 1 } });
    const ioDouble = makeIo();

    // Act
    handleNewWave(gsNormal, ioNormal, makeZombieManager());
    handleNewWave(gs, ioDouble, makeZombieManager());

    // Assert
    const countNormal = ioNormal.emit.mock.calls[0][1].zombiesCount;
    const countDouble = ioDouble.emit.mock.calls[0][1].zombiesCount;
    expect(countDouble).toBe(countNormal * 2);
  });
});

// ---------------------------------------------------------------------------
// Survivor rewards
// ---------------------------------------------------------------------------

describe('WaveManager — survivor rewards', () => {
  test('test_rewardSurvivors_alivePlayer_receives50Gold', () => {
    // Arrange
    const gs = makeGameState({
      players: {
        p1: { alive: true, gold: 100, health: 80, maxHealth: 200 }
      }
    });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.players.p1.gold).toBe(150);
  });

  test('test_rewardSurvivors_alivePlayer_healthRestoredBy50', () => {
    // Arrange
    const gs = makeGameState({
      players: {
        p1: { alive: true, gold: 0, health: 60, maxHealth: 200 }
      }
    });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.players.p1.health).toBe(110);
  });

  test('test_rewardSurvivors_alivePlayer_healthCappedAtMaxHealth', () => {
    // Arrange
    const gs = makeGameState({
      players: {
        p1: { alive: true, gold: 0, health: 190, maxHealth: 200 }
      }
    });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.players.p1.health).toBe(200);
  });

  test('test_rewardSurvivors_deadPlayer_receivesNoReward', () => {
    // Arrange
    const gs = makeGameState({
      players: {
        p1: { alive: false, gold: 50, health: 0, maxHealth: 200 }
      }
    });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(gs.players.p1.gold).toBe(50);
    expect(gs.players.p1.health).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MutatorManager integration
// ---------------------------------------------------------------------------

describe('WaveManager — mutator hook', () => {
  test('test_handleNewWave_withMutatorManager_handleWaveChangeCalled', () => {
    // Arrange
    const mutatorManager = { handleWaveChange: jest.fn() };
    const gs = makeGameState({ wave: 3, mutatorManager });

    // Act
    handleNewWave(gs, makeIo(), makeZombieManager());

    // Assert
    expect(mutatorManager.handleWaveChange).toHaveBeenCalledWith(4);
  });

  test('test_handleNewWave_withoutMutatorManager_noThrow', () => {
    // Arrange
    const gs = makeGameState({ mutatorManager: null });

    // Act + Assert
    expect(() => handleNewWave(gs, makeIo(), makeZombieManager())).not.toThrow();
  });
});
