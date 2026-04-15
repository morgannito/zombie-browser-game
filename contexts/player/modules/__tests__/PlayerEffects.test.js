/**
 * Unit tests for contexts/player/modules/PlayerEffects.js
 * Focus: milestone bonus dispatch + per-level stat application.
 */

const { applyMilestoneBonus } = require('../PlayerEffects');

function makePlayer(overrides = {}) {
  return {
    level: 1,
    health: 100,
    maxHealth: 100,
    damageMultiplier: 1,
    speedMultiplier: 1,
    fireRateMultiplier: 1,
    criticalChance: 0,
    lifeSteal: 0,
    ...overrides
  };
}

describe('applyMilestoneBonus', () => {
  test('level 5: +50 maxHealth, caps heal at maxHealth', () => {
    const player = makePlayer({ level: 5, health: 80, maxHealth: 100 });
    const result = applyMilestoneBonus(player);
    expect(player.maxHealth).toBe(150);
    expect(player.health).toBe(130); // 80 + 50 ≤ 150
    expect(result.title).toContain('PALIER 5');
    expect(result.icon).toBe('❤️');
  });

  test('level 5: heal clamps to new maxHealth when healing would overflow', () => {
    const player = makePlayer({ level: 5, health: 145, maxHealth: 100 });
    applyMilestoneBonus(player);
    expect(player.health).toBe(150);
  });

  test('level 10: stacking damage + speed multipliers', () => {
    const player = makePlayer({ level: 10, damageMultiplier: 2, speedMultiplier: 1 });
    const result = applyMilestoneBonus(player);
    expect(player.damageMultiplier).toBeCloseTo(2.5);
    expect(player.speedMultiplier).toBeCloseTo(1.2);
    expect(result.title).toContain('PALIER 10');
  });

  test('level 10: defaults multipliers when undefined', () => {
    const player = { level: 10 };
    applyMilestoneBonus(player);
    expect(player.damageMultiplier).toBeCloseTo(1.25);
    expect(player.speedMultiplier).toBeCloseTo(1.2);
  });

  test('level 15: reduces fire-rate, adds crit chance', () => {
    const player = makePlayer({ level: 15, fireRateMultiplier: 1, criticalChance: 0.1 });
    const result = applyMilestoneBonus(player);
    expect(player.fireRateMultiplier).toBeCloseTo(0.75);
    expect(player.criticalChance).toBeCloseTo(0.25);
    expect(result.title).toContain('PALIER 15');
  });

  test('level 20: +100 maxHealth full heal + 10% lifeSteal', () => {
    const player = makePlayer({ level: 20, health: 50, maxHealth: 100, lifeSteal: 0.05 });
    applyMilestoneBonus(player);
    expect(player.maxHealth).toBe(200);
    expect(player.health).toBe(200); // full heal
    expect(player.lifeSteal).toBeCloseTo(0.15);
  });

  test('level 25 (generic): +30 maxHealth, +10% damage', () => {
    const player = makePlayer({ level: 25, damageMultiplier: 1 });
    const result = applyMilestoneBonus(player);
    expect(player.maxHealth).toBe(130);
    expect(player.damageMultiplier).toBeCloseTo(1.1);
    expect(result.title).toBe('🎖️ PALIER 25 !');
  });

  test('level 100 uses generic formula', () => {
    const player = makePlayer({ level: 100, maxHealth: 500, damageMultiplier: 3 });
    const result = applyMilestoneBonus(player);
    expect(player.maxHealth).toBe(530);
    expect(player.damageMultiplier).toBeCloseTo(3.3);
    expect(result.title).toContain('PALIER 100');
  });

  test('generic heal is capped at new maxHealth', () => {
    const player = makePlayer({ level: 30, health: 200, maxHealth: 100 });
    applyMilestoneBonus(player);
    expect(player.maxHealth).toBe(130);
    expect(player.health).toBe(130);
  });
});
