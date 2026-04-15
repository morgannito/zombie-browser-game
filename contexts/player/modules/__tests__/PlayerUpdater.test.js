/**
 * Unit tests for contexts/player/modules/PlayerUpdater.js
 * Focus: timers expiry, regeneration cadence, combo reset emission.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  GAMEPLAY_CONSTANTS: {
    COMBO_TIMEOUT: 5000,
    REGENERATION_TICK_INTERVAL: 1000
  }
}));

jest.mock('../AutoTurretHandler', () => ({
  updateAutoTurrets: jest.fn()
}));

jest.mock('../TeslaCoilHandler', () => ({
  updateTeslaCoil: jest.fn()
}));

const {
  updatePlayers,
  updatePlayerTimers,
  updatePlayerRegeneration
} = require('../PlayerUpdater');

function makeIO() {
  const emit = jest.fn();
  return { to: () => ({ emit }), __emit: emit };
}

describe('updatePlayerTimers', () => {
  test('clears spawnProtection when expired', () => {
    const player = { spawnProtection: true, spawnProtectionEndTime: 100, combo: 0 };
    updatePlayerTimers(player, 200, makeIO(), 'p1');
    expect(player.spawnProtection).toBe(false);
  });

  test('keeps spawnProtection within window', () => {
    const player = { spawnProtection: true, spawnProtectionEndTime: 200, combo: 0 };
    updatePlayerTimers(player, 100, makeIO(), 'p1');
    expect(player.spawnProtection).toBe(true);
  });

  test('clears invisibility when expired', () => {
    const player = { invisible: true, invisibleEndTime: 100, combo: 0 };
    updatePlayerTimers(player, 200, makeIO(), 'p1');
    expect(player.invisible).toBe(false);
  });

  test('reverts to pistol when weaponTimer elapses', () => {
    const player = { weapon: 'rocketLauncher', weaponTimer: 100, combo: 0 };
    updatePlayerTimers(player, 200, makeIO(), 'p1');
    expect(player.weapon).toBe('pistol');
    expect(player.weaponTimer).toBeNull();
  });

  test('clears speedBoost when elapsed', () => {
    const player = { speedBoost: 100, combo: 0 };
    updatePlayerTimers(player, 200, makeIO(), 'p1');
    expect(player.speedBoost).toBeNull();
  });

  test('resets combo and emits comboReset after timeout', () => {
    const player = { combo: 10, comboTimer: 100, highestCombo: 5 };
    const io = makeIO();
    updatePlayerTimers(player, 10000, io, 'p1');
    expect(player.combo).toBe(0);
    expect(player.highestCombo).toBe(10);
    expect(io.__emit).toHaveBeenCalledWith('comboReset', expect.any(Object));
  });

  test('bootstraps comboTimer when missing', () => {
    const player = { combo: 3 };
    updatePlayerTimers(player, 1000, makeIO(), 'p1');
    expect(player.comboTimer).toBe(1000);
    expect(player.combo).toBe(3);
  });

  test('no combo action when combo ≤ 0', () => {
    const player = { combo: 0 };
    const io = makeIO();
    updatePlayerTimers(player, 10000, io, 'p1');
    expect(io.__emit).not.toHaveBeenCalled();
  });
});

describe('updatePlayerRegeneration', () => {
  test('no-op when regeneration is 0', () => {
    const player = { regeneration: 0, health: 50, maxHealth: 100 };
    updatePlayerRegeneration(player, 5000);
    expect(player.health).toBe(50);
  });

  test('initializes lastRegenTick on first call', () => {
    const player = { regeneration: 5, health: 50, maxHealth: 100 };
    updatePlayerRegeneration(player, 1000);
    expect(player.lastRegenTick).toBe(1000);
    expect(player.health).toBe(50); // no heal yet
  });

  test('heals once per tick interval', () => {
    const player = {
      regeneration: 5, health: 50, maxHealth: 100,
      lastRegenTick: 1
    };
    updatePlayerRegeneration(player, 1100);
    expect(player.health).toBe(55);
  });

  test('caps at maxHealth', () => {
    const player = {
      regeneration: 50, health: 95, maxHealth: 100,
      lastRegenTick: 1
    };
    updatePlayerRegeneration(player, 1100);
    expect(player.health).toBe(100);
  });

  test('lag compensation caps at 3 missed ticks', () => {
    const player = {
      regeneration: 10, health: 10, maxHealth: 200,
      lastRegenTick: 1
    };
    // 10s elapsed → 10 missed ticks, cap at 3 → +30 hp
    updatePlayerRegeneration(player, 10000);
    expect(player.health).toBe(40);
  });

  test('skips when within tick interval', () => {
    const player = {
      regeneration: 5, health: 50, maxHealth: 100,
      lastRegenTick: 1000
    };
    updatePlayerRegeneration(player, 1500);
    expect(player.health).toBe(50);
  });
});

describe('updatePlayers orchestrator', () => {
  const { updateAutoTurrets } = require('../AutoTurretHandler');
  const { updateTeslaCoil } = require('../TeslaCoilHandler');

  beforeEach(() => {
    updateAutoTurrets.mockClear();
    updateTeslaCoil.mockClear();
  });

  test('skips dead players', () => {
    const gameState = {
      players: {
        p1: { alive: false, combo: 0 }
      }
    };
    updatePlayers(gameState, 1000, makeIO(), {}, {});
    expect(updateAutoTurrets).not.toHaveBeenCalled();
    expect(updateTeslaCoil).not.toHaveBeenCalled();
  });

  test('runs timers/regen/turret/tesla for alive players', () => {
    const player = { alive: true, combo: 0, regeneration: 0 };
    const gameState = { players: { p1: player } };
    updatePlayers(gameState, 1000, makeIO(), {}, {});
    expect(updateAutoTurrets).toHaveBeenCalledWith(player, 'p1', 1000, {}, {}, gameState);
    expect(updateTeslaCoil).toHaveBeenCalled();
  });
});
