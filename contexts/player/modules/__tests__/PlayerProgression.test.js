/**
 * Unit tests for contexts/player/modules/PlayerProgression.js
 * Focus: combo counter, multiplier tiers, bonus/score math, combo update flow.
 */

jest.mock('../../../../game/utilityFunctions', () => ({
  getXPForLevel: jest.fn(() => 1000),
  generateUpgradeChoices: jest.fn(() => [])
}));

const { updatePlayerCombo } = require('../PlayerProgression');

function makeShooter(overrides = {}) {
  return {
    alive: true,
    combo: 0, comboTimer: 0, highestCombo: 0,
    kills: 0, zombiesKilled: 0,
    totalScore: 0,
    ...overrides
  };
}

function makeIO() {
  const fn = jest.fn();
  return { to: () => ({ emit: fn }), __emit: fn };
}

describe('updatePlayerCombo', () => {
  test('returns null when shooter missing', () => {
    const result = updatePlayerCombo('ghost', { goldDrop: 10, xpDrop: 5 }, { players: {} }, makeIO());
    expect(result).toBeNull();
  });

  test('returns null when shooter dead', () => {
    const gameState = { players: { p1: makeShooter({ alive: false }) } };
    expect(updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO())).toBeNull();
  });

  test('starts combo at 1 on first kill', () => {
    const shooter = makeShooter();
    const gameState = { players: { p1: shooter } };
    const io = makeIO();
    const result = updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, io);
    expect(shooter.combo).toBe(1);
    expect(shooter.kills).toBe(1);
    expect(shooter.highestCombo).toBe(1);
    expect(result).toEqual({ goldBonus: 10, xpBonus: 5 }); // x1 mult
  });

  test('resets to 1 after combo timeout', () => {
    const shooter = makeShooter({ combo: 10, comboTimer: Date.now() - 60000, highestCombo: 10 });
    const gameState = { players: { p1: shooter } };
    updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    expect(shooter.combo).toBe(1);
    expect(shooter.highestCombo).toBe(10); // kept
  });

  test('increments combo within timeout window', () => {
    const shooter = makeShooter({ combo: 2, comboTimer: Date.now() - 100 });
    const gameState = { players: { p1: shooter } };
    updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    expect(shooter.combo).toBe(3);
  });

  test('tier x2 at combo ≥ 5', () => {
    const shooter = makeShooter({ combo: 4, comboTimer: Date.now() - 100 });
    const gameState = { players: { p1: shooter } };
    const result = updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    expect(shooter.combo).toBe(5);
    expect(result).toEqual({ goldBonus: 20, xpBonus: 10 });
  });

  test('tier x3 at combo ≥ 15', () => {
    const shooter = makeShooter({ combo: 14, comboTimer: Date.now() - 100 });
    const gameState = { players: { p1: shooter } };
    const result = updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    expect(result).toEqual({ goldBonus: 30, xpBonus: 15 });
  });

  test('tier x5 at combo ≥ 30', () => {
    const shooter = makeShooter({ combo: 29, comboTimer: Date.now() - 100 });
    const gameState = { players: { p1: shooter } };
    const result = updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    expect(result).toEqual({ goldBonus: 50, xpBonus: 25 });
  });

  test('tier x10 at combo ≥ 50', () => {
    const shooter = makeShooter({ combo: 49, comboTimer: Date.now() - 100 });
    const gameState = { players: { p1: shooter } };
    const result = updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    expect(result).toEqual({ goldBonus: 100, xpBonus: 50 });
  });

  test('updates highestCombo only when surpassed', () => {
    const shooter = makeShooter({ combo: 3, comboTimer: Date.now() - 100, highestCombo: 5 });
    const gameState = { players: { p1: shooter } };
    updatePlayerCombo('p1', { goldDrop: 0, xpDrop: 0 }, gameState, makeIO());
    expect(shooter.highestCombo).toBe(5); // 4 < 5, unchanged
  });

  test('defends against invalid drop values', () => {
    const shooter = makeShooter();
    const gameState = { players: { p1: shooter } };
    const result = updatePlayerCombo('p1', { goldDrop: NaN, xpDrop: undefined }, gameState, makeIO());
    expect(result).toEqual({ goldBonus: 0, xpBonus: 0 });
  });

  test('accumulates total score with combo bonus delta', () => {
    const shooter = makeShooter({ combo: 4, comboTimer: Date.now() - 100, totalScore: 100 });
    const gameState = { players: { p1: shooter } };
    updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, makeIO());
    // combo=5 → mult=2 → baseScore=15, comboScore=15*(2-1)=15 → +30
    expect(shooter.totalScore).toBe(130);
  });

  test('emits comboUpdate via io.to(playerId)', () => {
    const shooter = makeShooter();
    const gameState = { players: { p1: shooter } };
    const io = makeIO();
    updatePlayerCombo('p1', { goldDrop: 10, xpDrop: 5 }, gameState, io);
    expect(io.__emit).toHaveBeenCalledWith('comboUpdate', expect.objectContaining({
      combo: 1, multiplier: 1, goldBonus: 10, xpBonus: 5
    }));
  });
});
