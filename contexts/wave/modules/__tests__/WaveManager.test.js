/**
 * Unit tests for contexts/wave/modules/WaveManager.js
 * Focus: wave progression, zombie count scaling, survivor rewards, mutator hooks.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { ZOMBIES_PER_ROOM: 25 }
}));

const { handleNewWave } = require('../WaveManager');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGameState(overrides = {}) {
  return {
    wave: 1,
    bossSpawned: true,
    zombiesKilledThisWave: 10,
    zombiesSpawnedThisWave: 15,
    players: {},
    activeMutators: [],
    nextMutatorWave: 0,
    mutatorManager: null,
    mutatorEffects: null,
    ...overrides
  };
}

function makeZombieManager() {
  return { restartZombieSpawner: jest.fn() };
}

function makeIo() {
  return { emit: jest.fn() };
}

// ---------------------------------------------------------------------------
// incrementWave side-effects
// ---------------------------------------------------------------------------

describe('handleNewWave — incrementWave', () => {
  test('increments wave counter by one', () => {
    const gs = makeGameState({ wave: 3 });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(gs.wave).toBe(4);
  });

  test('resets bossSpawned to false', () => {
    const gs = makeGameState({ bossSpawned: true });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(gs.bossSpawned).toBe(false);
  });

  test('resets zombiesKilledThisWave to zero', () => {
    const gs = makeGameState({ zombiesKilledThisWave: 42 });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(gs.zombiesKilledThisWave).toBe(0);
  });

  test('resets zombiesSpawnedThisWave to zero', () => {
    const gs = makeGameState({ zombiesSpawnedThisWave: 99 });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(gs.zombiesSpawnedThisWave).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// restartSpawner
// ---------------------------------------------------------------------------

describe('handleNewWave — restartSpawner', () => {
  test('calls restartZombieSpawner on zombieManager', () => {
    const zm = makeZombieManager();
    handleNewWave(makeGameState(), makeIo(), zm);
    expect(zm.restartZombieSpawner).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// notifyPlayers — zombiesCount scaling
// ---------------------------------------------------------------------------

describe('handleNewWave — notifyPlayers zombiesCount', () => {
  test('emits newWave event with correct wave number', () => {
    const gs = makeGameState({ wave: 5 });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    expect(io.emit).toHaveBeenCalledWith('newWave', expect.objectContaining({ wave: 6 }));
  });

  test('zombie count for wave 1 equals ZOMBIES_PER_ROOM (25)', () => {
    // wave starts at 1, after increment it becomes 2 → effectiveWave=2 → 25 + (2-1)*7 = 32
    // Let's test wave=0 → becomes 1 → 25 + 0*7 = 25
    const gs = makeGameState({ wave: 0 });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.zombiesCount).toBe(25); // 25 + (1-1)*7 = 25
  });

  test('zombie count scales linearly with wave', () => {
    // wave=9 → becomes 10 → 25 + 9*7 = 88
    const gs = makeGameState({ wave: 9 });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.zombiesCount).toBe(88);
  });

  test('zombie count caps at wave 130 (effectiveWave capped)', () => {
    // wave=130 → becomes 131 → effectiveWave=min(131,130)=130 → 25 + 129*7 = 928
    const gs = makeGameState({ wave: 130 });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payloadAt131 = io.emit.mock.calls[0][1];

    const gs2 = makeGameState({ wave: 200 });
    const io2 = makeIo();
    handleNewWave(gs2, io2, makeZombieManager());
    const payloadAt201 = io2.emit.mock.calls[0][1];

    expect(payloadAt131.zombiesCount).toBe(payloadAt201.zombiesCount);
  });

  test('spawnCountMultiplier from mutatorEffects scales zombie count', () => {
    const gs = makeGameState({ wave: 0, mutatorEffects: { spawnCountMultiplier: 2 } });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.zombiesCount).toBe(50); // 25 * 2
  });

  test('emits activeMutators from gameState', () => {
    const gs = makeGameState({ activeMutators: ['speedBoost', 'doubleDamage'] });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.mutators).toEqual(['speedBoost', 'doubleDamage']);
  });

  test('emits empty mutators array when none active', () => {
    const gs = makeGameState({ activeMutators: undefined });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.mutators).toEqual([]);
  });

  test('emits nextMutatorWave from gameState', () => {
    const gs = makeGameState({ nextMutatorWave: 15 });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.nextMutatorWave).toBe(15);
  });

  test('nextMutatorWave defaults to 0 when absent', () => {
    const gs = makeGameState({ nextMutatorWave: undefined });
    const io = makeIo();
    handleNewWave(gs, io, makeZombieManager());
    const payload = io.emit.mock.calls[0][1];
    expect(payload.nextMutatorWave).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rewardSurvivors
// ---------------------------------------------------------------------------

describe('handleNewWave — rewardSurvivors', () => {
  test('alive player receives +50 gold', () => {
    const player = { alive: true, health: 100, maxHealth: 200, gold: 100 };
    const gs = makeGameState({ players: { p1: player } });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(player.gold).toBe(150);
  });

  test('alive player receives +50 health capped at maxHealth', () => {
    const player = { alive: true, health: 170, maxHealth: 200, gold: 0 };
    const gs = makeGameState({ players: { p1: player } });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(player.health).toBe(200);
  });

  test('dead player receives no reward', () => {
    const player = { alive: false, health: 0, maxHealth: 200, gold: 100 };
    const gs = makeGameState({ players: { p1: player } });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(player.gold).toBe(100);
    expect(player.health).toBe(0);
  });

  test('multiple alive players all rewarded independently', () => {
    const p1 = { alive: true, health: 50, maxHealth: 200, gold: 0 };
    const p2 = { alive: true, health: 100, maxHealth: 200, gold: 200 };
    const gs = makeGameState({ players: { p1, p2 } });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(p1.gold).toBe(50);
    expect(p2.gold).toBe(250);
  });

  test('mixed alive/dead: only alive player rewarded', () => {
    const alive = { alive: true, health: 80, maxHealth: 200, gold: 0 };
    const dead = { alive: false, health: 0, maxHealth: 200, gold: 0 };
    const gs = makeGameState({ players: { alive, dead } });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(alive.gold).toBe(50);
    expect(dead.gold).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mutatorManager hook
// ---------------------------------------------------------------------------

describe('handleNewWave — mutatorManager', () => {
  test('calls mutatorManager.handleWaveChange with new wave number when present', () => {
    const mutatorManager = { handleWaveChange: jest.fn() };
    const gs = makeGameState({ wave: 4, mutatorManager });
    handleNewWave(gs, makeIo(), makeZombieManager());
    expect(mutatorManager.handleWaveChange).toHaveBeenCalledWith(5);
  });

  test('does not throw when mutatorManager is null', () => {
    const gs = makeGameState({ mutatorManager: null });
    expect(() => handleNewWave(gs, makeIo(), makeZombieManager())).not.toThrow();
  });
});
