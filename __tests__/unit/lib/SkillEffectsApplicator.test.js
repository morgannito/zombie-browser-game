/**
 * Unit tests for lib/server/SkillEffectsApplicator.js
 */

const SkillEffectsApplicator = require('../../../lib/server/SkillEffectsApplicator');

function makePlayer(overrides = {}) {
  return {
    id: 'p1',
    health: 100,
    maxHealth: 100,
    gold: 0,
    alive: true,
    ...overrides
  };
}

// --- applySkillBonuses ---

describe('SkillEffectsApplicator applySkillBonuses', () => {
  test('applySkillBonuses_nullPlayer_returnsNull', () => {
    const result = SkillEffectsApplicator.applySkillBonuses(null, {}, {});

    expect(result).toBeNull();
  });

  test('applySkillBonuses_nullBonuses_returnsPlayerUnchanged', () => {
    const player = makePlayer();

    const result = SkillEffectsApplicator.applySkillBonuses(player, null, {});

    expect(result).toBe(player);
    expect(result.health).toBe(100);
  });

  test('applySkillBonuses_maxHealthBonus_increasesMaxAndCurrentHealth', () => {
    const player = makePlayer({ health: 100, maxHealth: 100 });

    SkillEffectsApplicator.applySkillBonuses(player, { maxHealthBonus: 50 }, {});

    expect(player.maxHealth).toBe(150);
    expect(player.health).toBe(150);
  });

  test('applySkillBonuses_startingGold_addsToPlayerGold', () => {
    const player = makePlayer({ gold: 10 });

    SkillEffectsApplicator.applySkillBonuses(player, { startingGold: 100 }, {});

    expect(player.gold).toBe(110);
  });

  test('applySkillBonuses_regeneration_setsPlayerRegeneration', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { regeneration: 5 }, {});

    expect(player.regeneration).toBe(5);
  });

  test('applySkillBonuses_regeneration_accumulatesWhenAlreadySet', () => {
    const player = makePlayer({ regeneration: 3 });

    SkillEffectsApplicator.applySkillBonuses(player, { regeneration: 2 }, {});

    expect(player.regeneration).toBe(5);
  });

  test('applySkillBonuses_piercing_setsPlayerPiercing', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { piercing: 2 }, {});

    expect(player.piercing).toBe(2);
  });

  test('applySkillBonuses_maxShield_setsShieldAndRegen', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { maxShield: 200, shieldRegen: 10 }, {});

    expect(player.maxShield).toBe(200);
    expect(player.shield).toBe(200);
    expect(player.shieldRegen).toBe(10);
  });

  test('applySkillBonuses_maxShield_defaultsShieldRegenToZero', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { maxShield: 100 }, {});

    expect(player.shieldRegen).toBe(0);
  });

  test('applySkillBonuses_damageMultiplier_addsToCurrent', () => {
    const player = makePlayer({ damageMultiplier: 1.0 });

    SkillEffectsApplicator.applySkillBonuses(player, { damageMultiplier: 0.5 }, {});

    expect(player.damageMultiplier).toBeCloseTo(1.5);
  });

  test('applySkillBonuses_damageMultiplier_defaultsBaseToOne', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { damageMultiplier: 0.3 }, {});

    expect(player.damageMultiplier).toBeCloseTo(1.3);
  });

  test('applySkillBonuses_speedMultiplier_addsToCurrent', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { speedMultiplier: 0.2 }, {});

    expect(player.speedMultiplier).toBeCloseTo(1.2);
  });

  test('applySkillBonuses_critChance_addsToPlayerCritChance', () => {
    const player = makePlayer({ critChance: 0.1 });

    SkillEffectsApplicator.applySkillBonuses(player, { critChance: 0.05 }, {});

    expect(player.critChance).toBeCloseTo(0.15);
  });

  test('applySkillBonuses_critMultiplier_aboveOne_setsIt', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { critMultiplier: 2.0 }, {});

    expect(player.critMultiplier).toBe(2.0);
  });

  test('applySkillBonuses_critMultiplier_leOne_notApplied', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { critMultiplier: 1.0 }, {});

    expect(player.critMultiplier).toBeUndefined();
  });

  test('applySkillBonuses_dodgeChance_setsPlayerDodgeChance', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { dodgeChance: 0.15 }, {});

    expect(player.dodgeChance).toBeCloseTo(0.15);
  });

  test('applySkillBonuses_lifeSteal_setsPlayerLifeSteal', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { lifeSteal: 0.1 }, {});

    expect(player.lifeSteal).toBeCloseTo(0.1);
  });

  test('applySkillBonuses_thornsDamage_setsPlayerThornsDamage', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { thornsDamage: 0.3 }, {});

    expect(player.thornsDamage).toBeCloseTo(0.3);
  });

  test('applySkillBonuses_explosiveRounds_setsFlag', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { explosiveRounds: true }, {});

    expect(player.explosiveRounds).toBe(true);
    expect(player.explosionRadius).toBe(100);
    expect(player.explosionDamagePercent).toBe(0.5);
  });

  test('applySkillBonuses_damageImmunity_setsFlag', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(
      player,
      { damageImmunity: true, immunityCooldown: 20000 },
      {}
    );

    expect(player.hasDamageImmunity).toBe(true);
    expect(player.immunityCooldown).toBe(20000);
  });

  test('applySkillBonuses_damageImmunity_defaultsCooldown', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { damageImmunity: true }, {});

    expect(player.immunityCooldown).toBe(15000);
  });

  test('applySkillBonuses_secondChance_setsFlags', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { secondChance: true }, {});

    expect(player.hasSecondChance).toBe(true);
    expect(player.secondChanceUsed).toBe(false);
  });

  test('applySkillBonuses_berserker_setsBerserkerFields', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(
      player,
      { berserkerDamage: 0.5, berserkerSpeed: 0.3, berserkerThreshold: 0.3 },
      {}
    );

    expect(player.berserkerDamage).toBe(0.5);
    expect(player.berserkerSpeed).toBe(0.3);
    expect(player.berserkerThreshold).toBe(0.3);
  });

  test('applySkillBonuses_emptyBonuses_playerUnchanged', () => {
    const player = makePlayer({ health: 100, maxHealth: 100, gold: 0 });

    SkillEffectsApplicator.applySkillBonuses(player, {}, {});

    expect(player.health).toBe(100);
    expect(player.maxHealth).toBe(100);
    expect(player.gold).toBe(0);
  });

  test('applySkillBonuses_multishotCount_setsPlayerField', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { multishotCount: 2 }, {});

    expect(player.multishotCount).toBe(2);
  });

  test('applySkillBonuses_autoTurrets_setsPlayerField', () => {
    const player = makePlayer();

    SkillEffectsApplicator.applySkillBonuses(player, { autoTurrets: 1 }, {});

    expect(player.autoTurrets).toBe(1);
  });
});

// --- checkBerserkerMode ---

describe('SkillEffectsApplicator checkBerserkerMode', () => {
  test('checkBerserkerMode_noBerserkerDamage_returnsFalse', () => {
    const player = makePlayer({ health: 20, maxHealth: 100 });

    const result = SkillEffectsApplicator.checkBerserkerMode(player);

    expect(result).toBe(false);
  });

  test('checkBerserkerMode_healthAboveThreshold_returnsFalse', () => {
    const player = makePlayer({
      health: 80,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3
    });

    const result = SkillEffectsApplicator.checkBerserkerMode(player);

    expect(result).toBe(false);
  });

  test('checkBerserkerMode_healthAtThreshold_returnsTrue', () => {
    const player = makePlayer({
      health: 30,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3
    });

    const result = SkillEffectsApplicator.checkBerserkerMode(player);

    expect(result).toBe(true);
  });

  test('checkBerserkerMode_healthBelowThreshold_activatesBerserker', () => {
    const player = makePlayer({
      health: 25,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3
    });

    SkillEffectsApplicator.checkBerserkerMode(player);

    expect(player.berserkerActive).toBe(true);
  });

  test('checkBerserkerMode_aboveThresholdAfterBeingActive_deactivates', () => {
    const player = makePlayer({
      health: 80,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3,
      berserkerActive: true
    });

    SkillEffectsApplicator.checkBerserkerMode(player);

    expect(player.berserkerActive).toBe(false);
  });
});

// --- applyBerserkerDamage ---

describe('SkillEffectsApplicator applyBerserkerDamage', () => {
  test('applyBerserkerDamage_berserkerInactive_returnsBaseDamage', () => {
    const player = makePlayer({ health: 80, maxHealth: 100 });

    const result = SkillEffectsApplicator.applyBerserkerDamage(100, player);

    expect(result).toBe(100);
  });

  test('applyBerserkerDamage_berserkerActive_multipliesDamage', () => {
    const player = makePlayer({
      health: 20,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3
    });

    const result = SkillEffectsApplicator.applyBerserkerDamage(100, player);

    expect(result).toBe(150);
  });
});

// --- applyBerserkerSpeed ---

describe('SkillEffectsApplicator applyBerserkerSpeed', () => {
  test('applyBerserkerSpeed_berserkerInactive_returnsBaseSpeed', () => {
    const player = makePlayer({ health: 80, maxHealth: 100 });

    const result = SkillEffectsApplicator.applyBerserkerSpeed(200, player);

    expect(result).toBe(200);
  });

  test('applyBerserkerSpeed_berserkerActive_multipliesSpeed', () => {
    const player = makePlayer({
      health: 20,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerSpeed: 0.25,
      berserkerThreshold: 0.3
    });

    const result = SkillEffectsApplicator.applyBerserkerSpeed(200, player);

    expect(result).toBe(250);
  });
});

// --- handleIncomingDamage ---

describe('SkillEffectsApplicator handleIncomingDamage', () => {
  test('handleIncomingDamage_noSpecialSkills_returnsFullDamage', () => {
    const player = makePlayer();

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(result.actualDamage).toBe(50);
    expect(result.blocked).toBe(false);
    expect(result.reflected).toBe(0);
  });

  test('handleIncomingDamage_guaranteedDodge_blocksAllDamage', () => {
    const player = makePlayer({ dodgeChance: 1.0 });

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(result.blocked).toBe(true);
    expect(result.actualDamage).toBe(0);
  });

  test('handleIncomingDamage_noDodge_doesNotBlock', () => {
    const player = makePlayer({ dodgeChance: 0.0 });

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(result.blocked).toBe(false);
    expect(result.actualDamage).toBe(50);
  });

  test('handleIncomingDamage_shieldAbsorbsPartialDamage_reducesShield', () => {
    const player = makePlayer({ shield: 30 });

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(result.actualDamage).toBe(20);
    expect(player.shield).toBe(0);
  });

  test('handleIncomingDamage_shieldAbsorbsFullDamage_blocks', () => {
    const player = makePlayer({ shield: 100 });

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(result.blocked).toBe(true);
    expect(result.actualDamage).toBe(0);
    expect(player.shield).toBe(50);
  });

  test('handleIncomingDamage_withThorns_reflectsDamageToAttacker', () => {
    const player = makePlayer({ thornsDamage: 0.5 });
    const attacker = { health: 200 };

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50, attacker);

    expect(result.reflected).toBe(25);
    expect(attacker.health).toBe(175);
  });

  test('handleIncomingDamage_withThornsNoAttacker_noReflection', () => {
    const player = makePlayer({ thornsDamage: 0.5 });

    const result = SkillEffectsApplicator.handleIncomingDamage(player, 50, null);

    expect(result.reflected).toBe(0);
  });

  test('handleIncomingDamage_notBlocked_updatesLastDamageTime', () => {
    const player = makePlayer();
    const before = Date.now();

    SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(player.lastDamageTime).toBeGreaterThanOrEqual(before);
  });

  test('handleIncomingDamage_blocked_doesNotUpdateLastDamageTime', () => {
    const player = makePlayer({ dodgeChance: 1.0 });

    SkillEffectsApplicator.handleIncomingDamage(player, 50);

    expect(player.lastDamageTime).toBeUndefined();
  });
});

// --- checkSecondChance ---

describe('SkillEffectsApplicator checkSecondChance', () => {
  test('checkSecondChance_noSecondChance_returnsFalse', () => {
    const player = makePlayer({ health: 0 });

    const result = SkillEffectsApplicator.checkSecondChance(player);

    expect(result).toBe(false);
  });

  test('checkSecondChance_alreadyUsed_returnsFalse', () => {
    const player = makePlayer({ health: 0, hasSecondChance: true, secondChanceUsed: true });

    const result = SkillEffectsApplicator.checkSecondChance(player);

    expect(result).toBe(false);
  });

  test('checkSecondChance_healthAboveZero_returnsFalse', () => {
    const player = makePlayer({ health: 10, hasSecondChance: true, secondChanceUsed: false });

    const result = SkillEffectsApplicator.checkSecondChance(player);

    expect(result).toBe(false);
  });

  test('checkSecondChance_eligible_returnsTrue', () => {
    const player = makePlayer({
      health: 0,
      maxHealth: 100,
      hasSecondChance: true,
      secondChanceUsed: false
    });

    const result = SkillEffectsApplicator.checkSecondChance(player);

    expect(result).toBe(true);
  });

  test('checkSecondChance_eligible_revivesPlayerAtHalfHealth', () => {
    const player = makePlayer({
      health: 0,
      maxHealth: 100,
      hasSecondChance: true,
      secondChanceUsed: false
    });

    SkillEffectsApplicator.checkSecondChance(player);

    expect(player.health).toBe(50);
  });

  test('checkSecondChance_eligible_marksSecondChanceAsUsed', () => {
    const player = makePlayer({
      health: 0,
      maxHealth: 100,
      hasSecondChance: true,
      secondChanceUsed: false
    });

    SkillEffectsApplicator.checkSecondChance(player);

    expect(player.secondChanceUsed).toBe(true);
  });

  test('checkSecondChance_cannotBeUsedTwice', () => {
    const player = makePlayer({
      health: 0,
      maxHealth: 100,
      hasSecondChance: true,
      secondChanceUsed: false
    });

    SkillEffectsApplicator.checkSecondChance(player);
    player.health = 0; // simulate dying again
    const secondResult = SkillEffectsApplicator.checkSecondChance(player);

    expect(secondResult).toBe(false);
  });
});
