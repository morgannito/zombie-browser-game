/**
 * Unit tests for lib/server/RunMutatorManager.js
 */

const RunMutatorManager = require('../../../lib/server/RunMutatorManager');

function makeGameState(overrides = {}) {
  return { wave: 1, ...overrides };
}

function makeManager(gameState, io = null, options = {}) {
  return new RunMutatorManager(gameState, io, options);
}

// --- Constructor ---

describe('RunMutatorManager constructor', () => {
  test('initializes_defaultEffects_allOnesOrDefault', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.defaultEffects.zombieHealthMultiplier).toBe(1);
    expect(mgr.defaultEffects.playerDamageMultiplier).toBe(1);
    expect(mgr.defaultEffects.spawnCountMultiplier).toBe(1);
  });

  test('initializes_rotationInterval_fromOptions', () => {
    const mgr = makeManager(makeGameState(), null, { rotationInterval: 5 });

    expect(mgr.rotationInterval).toBe(5);
  });

  test('initializes_rotationInterval_defaultWhenNotProvided', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.rotationInterval).toBe(10);
  });

  test('initializes_activeMutators_asEmptyArray', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.activeMutators).toEqual([]);
  });
});

// --- clamp ---

describe('RunMutatorManager clamp', () => {
  test('clamp_valueWithinRange_returnsValue', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.clamp(1.0, 0.5, 1.5)).toBe(1.0);
  });

  test('clamp_valueBelowMin_returnsMin', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.clamp(0.2, 0.5, 1.5)).toBe(0.5);
  });

  test('clamp_valueAboveMax_returnsMax', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.clamp(2.0, 0.5, 1.5)).toBe(1.5);
  });
});

// --- getMutatorPool ---

describe('RunMutatorManager getMutatorPool', () => {
  test('getMutatorPool_returns_fiveEntries', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.getMutatorPool()).toHaveLength(5);
  });

  test('getMutatorPool_eachEntry_hasRequiredFields', () => {
    const mgr = makeManager(makeGameState());

    mgr.getMutatorPool().forEach(m => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('description');
      expect(m).toHaveProperty('effects');
    });
  });
});

// --- pickMutators ---

describe('RunMutatorManager pickMutators', () => {
  test('pickMutators_returnsTwoMutators', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.pickMutators()).toHaveLength(2);
  });

  test('pickMutators_returnsSubsetOfPool', () => {
    const mgr = makeManager(makeGameState());
    const poolIds = mgr.getMutatorPool().map(m => m.id);

    const picked = mgr.pickMutators();

    picked.forEach(m => expect(poolIds).toContain(m.id));
  });
});

// --- toPublicMutator ---

describe('RunMutatorManager toPublicMutator', () => {
  test('toPublicMutator_exposesPublicFields', () => {
    const mgr = makeManager(makeGameState());
    const full = {
      id: 'x',
      name: 'X',
      description: 'desc',
      tags: ['+a'],
      effects: { zombieHealthMultiplier: 1.2 }
    };

    const pub = mgr.toPublicMutator(full);

    expect(pub).toEqual({ id: 'x', name: 'X', description: 'desc', tags: ['+a'] });
  });

  test('toPublicMutator_missingTags_defaultsToEmptyArray', () => {
    const mgr = makeManager(makeGameState());
    const full = { id: 'x', name: 'X', description: 'desc', effects: {} };

    const pub = mgr.toPublicMutator(full);

    expect(pub.tags).toEqual([]);
  });

  test('toPublicMutator_doesNotExposeEffects', () => {
    const mgr = makeManager(makeGameState());
    const full = {
      id: 'x',
      name: 'X',
      description: 'desc',
      effects: { zombieHealthMultiplier: 2 }
    };

    const pub = mgr.toPublicMutator(full);

    expect(pub).not.toHaveProperty('effects');
  });
});

// --- buildEffects ---

describe('RunMutatorManager buildEffects', () => {
  test('buildEffects_noMutators_returnsDefaultEffects', () => {
    const mgr = makeManager(makeGameState());

    const effects = mgr.buildEffects([]);

    expect(effects.zombieHealthMultiplier).toBe(1);
    expect(effects.playerDamageMultiplier).toBe(1);
  });

  test('buildEffects_singleMutator_multipliesCorrectly', () => {
    const mgr = makeManager(makeGameState());
    const mutators = [{ id: 'test', effects: { zombieHealthMultiplier: 1.25 } }];

    const effects = mgr.buildEffects(mutators);

    expect(effects.zombieHealthMultiplier).toBe(1.25);
  });

  test('buildEffects_twoMutators_compoundsMultipliers', () => {
    const mgr = makeManager(makeGameState());
    const mutators = [
      { id: 'a', effects: { zombieDamageMultiplier: 1.25 } },
      { id: 'b', effects: { zombieDamageMultiplier: 1.2 } }
    ];

    const effects = mgr.buildEffects(mutators);

    expect(effects.zombieDamageMultiplier).toBeCloseTo(1.25 * 1.2);
  });

  test('buildEffects_mutatorWithoutEffects_isIgnored', () => {
    const mgr = makeManager(makeGameState());
    const mutators = [{ id: 'a' }];

    const effects = mgr.buildEffects(mutators);

    expect(effects.zombieHealthMultiplier).toBe(1);
  });

  test('buildEffects_spawnIntervalMultiplier_clampedAtLowerBound', () => {
    const mgr = makeManager(makeGameState());
    const mutators = [{ id: 'a', effects: { spawnIntervalMultiplier: 0.1 } }];

    const effects = mgr.buildEffects(mutators);

    expect(effects.spawnIntervalMultiplier).toBe(0.6);
  });

  test('buildEffects_zombieHealthMultiplier_clampedAtUpperBound', () => {
    const mgr = makeManager(makeGameState());
    const mutators = [{ id: 'a', effects: { zombieHealthMultiplier: 5.0 } }];

    const effects = mgr.buildEffects(mutators);

    expect(effects.zombieHealthMultiplier).toBe(1.4);
  });

  test('buildEffects_nonNumericEffectValue_isIgnored', () => {
    const mgr = makeManager(makeGameState());
    const mutators = [{ id: 'a', effects: { zombieHealthMultiplier: 'big' } }];

    const effects = mgr.buildEffects(mutators);

    expect(effects.zombieHealthMultiplier).toBe(1);
  });
});

// --- rotateIfNeeded ---

describe('RunMutatorManager rotateIfNeeded', () => {
  test('rotateIfNeeded_force_alwaysRotates', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState);

    const rotated = mgr.rotateIfNeeded(1, true);

    expect(rotated).toBe(true);
  });

  test('rotateIfNeeded_belowInterval_returnsFalse', () => {
    const mgr = makeManager(makeGameState(), null, { rotationInterval: 10 });
    mgr.lastRotationWave = 1;

    const rotated = mgr.rotateIfNeeded(5);

    expect(rotated).toBe(false);
  });

  test('rotateIfNeeded_atInterval_rotates', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });
    mgr.lastRotationWave = 0;

    const rotated = mgr.rotateIfNeeded(10);

    expect(rotated).toBe(true);
  });

  test('rotateIfNeeded_updatesGameStateMutators', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState);

    mgr.rotateIfNeeded(1, true);

    expect(Array.isArray(gameState.activeMutators)).toBe(true);
    expect(gameState.activeMutators).toHaveLength(2);
  });

  test('rotateIfNeeded_updatesNextMutatorWave', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });

    mgr.rotateIfNeeded(5, true);

    expect(gameState.nextMutatorWave).toBe(15);
  });

  test('rotateIfNeeded_activeMutatorsArePublicOnly', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState);

    mgr.rotateIfNeeded(1, true);

    gameState.activeMutators.forEach(m => {
      expect(m).not.toHaveProperty('effects');
    });
  });
});

// --- initialize ---

describe('RunMutatorManager initialize', () => {
  test('initialize_forcesRotation', () => {
    const gameState = makeGameState({ wave: 5 });
    const mgr = makeManager(gameState);

    mgr.initialize();

    expect(Array.isArray(gameState.activeMutators)).toBe(true);
  });

  test('initialize_usesGameStateWave', () => {
    const gameState = makeGameState({ wave: 20 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });

    mgr.initialize();

    expect(gameState.nextMutatorWave).toBe(30);
  });
});

// --- handleWaveChange ---

describe('RunMutatorManager handleWaveChange', () => {
  test('handleWaveChange_sufficientInterval_returnsTrue', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });
    mgr.lastRotationWave = 0;

    const result = mgr.handleWaveChange(10);

    expect(result).toBe(true);
  });

  test('handleWaveChange_insufficientInterval_returnsFalse', () => {
    const mgr = makeManager(makeGameState(), null, { rotationInterval: 10 });
    mgr.lastRotationWave = 5;

    const result = mgr.handleWaveChange(8);

    expect(result).toBe(false);
  });
});

// --- broadcastMutators ---

describe('RunMutatorManager broadcastMutators', () => {
  test('broadcastMutators_withIo_emitsMutatorsUpdated', () => {
    const emitted = [];
    const io = { emit: (event, data) => emitted.push({ event, data }) };
    const gameState = makeGameState({
      activeMutators: [],
      mutatorEffects: {},
      nextMutatorWave: 11
    });
    const mgr = makeManager(gameState, io);

    mgr.broadcastMutators(1);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('mutatorsUpdated');
  });

  test('broadcastMutators_withoutIo_doesNotThrow', () => {
    const gameState = makeGameState({
      activeMutators: [],
      mutatorEffects: {},
      nextMutatorWave: 11
    });
    const mgr = makeManager(gameState, null);

    expect(() => mgr.broadcastMutators(1)).not.toThrow();
  });

  test('broadcastMutators_emitPayload_containsWaveAndMutators', () => {
    const emitted = [];
    const io = { emit: (event, data) => emitted.push(data) };
    const gameState = makeGameState({
      activeMutators: [{ id: 'x' }],
      mutatorEffects: {},
      nextMutatorWave: 11
    });
    const mgr = makeManager(gameState, io);

    mgr.broadcastMutators(1);

    expect(emitted[0].wave).toBe(1);
    expect(emitted[0].mutators).toEqual([{ id: 'x' }]);
  });
});

// --- hasActiveMutators (cache flag) ---

describe('RunMutatorManager hasActiveMutators', () => {
  test('hasActiveMutators_beforeInitialize_returnsFalse', () => {
    const mgr = makeManager(makeGameState());

    expect(mgr.hasActiveMutators()).toBe(false);
  });

  test('hasActiveMutators_afterRotate_returnsTrue', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState);

    mgr.rotateIfNeeded(1, true);

    expect(mgr.hasActiveMutators()).toBe(true);
  });
});

// --- handleWaveChange nextMutatorWave fast-skip ---

describe('RunMutatorManager handleWaveChange nextMutatorWave skip', () => {
  test('handleWaveChange_waveBelowNextMutatorWave_returnsFalse', () => {
    const gameState = makeGameState({ wave: 1, nextMutatorWave: 20 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });

    const result = mgr.handleWaveChange(15);

    expect(result).toBe(false);
  });

  test('handleWaveChange_waveAtNextMutatorWave_returnsTrue', () => {
    const gameState = makeGameState({ wave: 1, nextMutatorWave: 10 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });
    mgr.lastRotationWave = 0;

    const result = mgr.handleWaveChange(10);

    expect(result).toBe(true);
  });
});

// --- cleanupWave ---

describe('RunMutatorManager cleanupWave', () => {
  test('cleanupWave_resetsActiveMutators', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState);
    mgr.rotateIfNeeded(1, true);

    mgr.cleanupWave();

    expect(mgr.activeMutators).toHaveLength(0);
    expect(gameState.activeMutators).toHaveLength(0);
  });

  test('cleanupWave_resetsEffectsToDefault', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState);
    mgr.rotateIfNeeded(1, true);

    mgr.cleanupWave();

    expect(gameState.mutatorEffects.zombieHealthMultiplier).toBe(1);
    expect(mgr.hasActiveMutators()).toBe(false);
  });
});

// --- pickMutators deduplication ---

describe('RunMutatorManager pickMutators deduplication', () => {
  test('pickMutators_noDuplicateIds', () => {
    const mgr = makeManager(makeGameState());

    for (let i = 0; i < 20; i++) {
      const picked = mgr.pickMutators();
      const ids = picked.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

// --- serialize / restore ---

describe('RunMutatorManager serialize and restore', () => {
  test('serialize_capturesState', () => {
    const gameState = makeGameState({ wave: 1 });
    const mgr = makeManager(gameState, null, { rotationInterval: 10 });
    mgr.rotateIfNeeded(5, true);

    const snap = mgr.serialize();

    expect(snap.lastRotationWave).toBe(5);
    expect(Array.isArray(snap.activeMutatorIds)).toBe(true);
    expect(snap.nextMutatorWave).toBe(15);
    expect(snap.effects).toBeDefined();
  });

  test('restore_rebuildsActiveMutators', () => {
    const gameState = makeGameState({ wave: 1 });
    const original = makeManager(gameState, null, { rotationInterval: 10 });
    original.rotateIfNeeded(5, true);
    const snap = original.serialize();

    const gameState2 = makeGameState();
    const restored = makeManager(gameState2, null, { rotationInterval: 10 });
    restored.restore(snap);

    expect(restored.lastRotationWave).toBe(5);
    expect(gameState2.nextMutatorWave).toBe(15);
    expect(restored.hasActiveMutators()).toBe(true);
    expect(gameState2.activeMutators.length).toBeGreaterThan(0);
  });

  test('restore_null_doesNotThrow', () => {
    const mgr = makeManager(makeGameState());

    expect(() => mgr.restore(null)).not.toThrow();
  });
});
