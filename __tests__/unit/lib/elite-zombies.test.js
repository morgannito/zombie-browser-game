'use strict';

const { ELITE_ZOMBIES } = require('../../../lib/server/zombie-types/elite-zombies');

describe('ELITE_ZOMBIES', () => {
  // --- Structure ---

  test('exports_object_with_ten_elite_types', () => {
    expect(Object.keys(ELITE_ZOMBIES)).toHaveLength(10);
  });

  test('contains_all_expected_elite_keys', () => {
    const expected = [
      'juggernaut',
      'assassin',
      'warlord',
      'plagueDoctor',
      'reaper',
      'archon',
      'dreadlord',
      'stormcaller',
      'corruptor',
      'behemoth'
    ];
    expect(Object.keys(ELITE_ZOMBIES)).toEqual(expect.arrayContaining(expected));
  });

  // --- isElite flag ---

  test('every_zombie_has_isElite_true', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.isElite).toBe(true);
    });
  });

  // --- Required base stats ---

  const BASE_FIELDS = ['name', 'health', 'speed', 'damage', 'xp', 'gold', 'size', 'color'];

  test.each(BASE_FIELDS)('every_zombie_has_required_field_%s', field => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z).toHaveProperty(field);
    });
  });

  test('every_zombie_has_positive_health', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.health).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_speed', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.speed).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_damage', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.damage).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_xp', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.xp).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_gold', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.gold).toBeGreaterThan(0);
    });
  });

  // --- Elite have superior stats vs standard ---

  test('all_elites_have_health_above_100', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.health).toBeGreaterThan(100);
    });
  });

  test('all_elites_have_damage_above_20', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.damage).toBeGreaterThan(20);
    });
  });

  test('all_elites_have_xp_above_50', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.xp).toBeGreaterThan(50);
    });
  });

  // --- juggernaut ---

  test('juggernaut_is_unstoppable', () => {
    expect(ELITE_ZOMBIES.juggernaut.unstoppable).toBe(true);
  });

  test('juggernaut_has_trample_damage_positive', () => {
    expect(ELITE_ZOMBIES.juggernaut.trampleDamage).toBeGreaterThan(0);
  });

  test('juggernaut_armorThickness_is_valid_ratio', () => {
    const val = ELITE_ZOMBIES.juggernaut.armorThickness;
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  // --- assassin ---

  test('assassin_has_stealth_true', () => {
    expect(ELITE_ZOMBIES.assassin.stealth).toBe(true);
  });

  test('assassin_criticalStrike_multiplier_above_1', () => {
    expect(ELITE_ZOMBIES.assassin.criticalStrike).toBeGreaterThan(1);
  });

  test('assassin_has_fastest_speed_among_elites', () => {
    const speeds = Object.values(ELITE_ZOMBIES).map(z => z.speed);
    expect(ELITE_ZOMBIES.assassin.speed).toBe(Math.max(...speeds));
  });

  test('assassin_stealthDuration_less_than_stealthCooldown', () => {
    expect(ELITE_ZOMBIES.assassin.stealthDuration).toBeLessThan(
      ELITE_ZOMBIES.assassin.stealthCooldown
    );
  });

  // --- warlord ---

  test('warlord_commandAura_is_true', () => {
    expect(ELITE_ZOMBIES.warlord.commandAura).toBe(true);
  });

  test('warlord_auraBuffMultiplier_above_1', () => {
    expect(ELITE_ZOMBIES.warlord.auraBuffMultiplier).toBeGreaterThan(1);
  });

  test('warlord_auraRadius_positive', () => {
    expect(ELITE_ZOMBIES.warlord.auraRadius).toBeGreaterThan(0);
  });

  // --- plagueDoctor ---

  test('plagueDoctor_infectOnHit_is_true', () => {
    expect(ELITE_ZOMBIES.plagueDoctor.infectOnHit).toBe(true);
  });

  test('plagueDoctor_infectionSpreadChance_is_valid_probability', () => {
    const val = ELITE_ZOMBIES.plagueDoctor.infectionSpreadChance;
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  // --- reaper ---

  test('reaper_has_soulHarvest_true', () => {
    expect(ELITE_ZOMBIES.reaper.soulHarvest).toBe(true);
  });

  test('reaper_maxStacks_positive', () => {
    expect(ELITE_ZOMBIES.reaper.maxStacks).toBeGreaterThan(0);
  });

  test('reaper_harvestStackBonus_is_small_fraction', () => {
    expect(ELITE_ZOMBIES.reaper.harvestStackBonus).toBeGreaterThan(0);
    expect(ELITE_ZOMBIES.reaper.harvestStackBonus).toBeLessThan(1);
  });

  test('reaper_has_higher_xp_than_assassin_and_stormcaller', () => {
    expect(ELITE_ZOMBIES.reaper.xp).toBeGreaterThan(ELITE_ZOMBIES.assassin.xp);
    expect(ELITE_ZOMBIES.reaper.xp).toBeGreaterThan(ELITE_ZOMBIES.stormcaller.xp);
  });

  // --- archon ---

  test('archon_divineShield_is_true', () => {
    expect(ELITE_ZOMBIES.archon.divineShield).toBe(true);
  });

  test('archon_shieldAbsorb_positive', () => {
    expect(ELITE_ZOMBIES.archon.shieldAbsorb).toBeGreaterThan(0);
  });

  test('archon_shieldRegen_positive', () => {
    expect(ELITE_ZOMBIES.archon.shieldRegen).toBeGreaterThan(0);
  });

  // --- behemoth ---

  test('behemoth_has_highest_health_among_elites', () => {
    const healths = Object.values(ELITE_ZOMBIES).map(z => z.health);
    expect(ELITE_ZOMBIES.behemoth.health).toBe(Math.max(...healths));
  });

  test('behemoth_has_highest_damage_among_elites', () => {
    const damages = Object.values(ELITE_ZOMBIES).map(z => z.damage);
    expect(ELITE_ZOMBIES.behemoth.damage).toBe(Math.max(...damages));
  });

  test('behemoth_has_highest_gold_reward', () => {
    const golds = Object.values(ELITE_ZOMBIES).map(z => z.gold);
    expect(ELITE_ZOMBIES.behemoth.gold).toBe(Math.max(...golds));
  });

  test('behemoth_has_highest_xp_reward', () => {
    const xps = Object.values(ELITE_ZOMBIES).map(z => z.xp);
    expect(ELITE_ZOMBIES.behemoth.xp).toBe(Math.max(...xps));
  });

  test('behemoth_has_lowest_speed_among_elites', () => {
    const speeds = Object.values(ELITE_ZOMBIES).map(z => z.speed);
    expect(ELITE_ZOMBIES.behemoth.speed).toBe(Math.min(...speeds));
  });

  test('behemoth_rockCooldown_less_than_earthquakeCooldown', () => {
    expect(ELITE_ZOMBIES.behemoth.rockCooldown).toBeLessThan(
      ELITE_ZOMBIES.behemoth.earthquakeCooldown
    );
  });

  // --- dreadlord ---

  test('dreadlord_fearSlow_is_valid_ratio', () => {
    const val = ELITE_ZOMBIES.dreadlord.fearSlow;
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  test('dreadlord_drainAmount_positive', () => {
    expect(ELITE_ZOMBIES.dreadlord.drainAmount).toBeGreaterThan(0);
  });

  // --- stormcaller ---

  test('stormcaller_chainJumps_at_least_1', () => {
    expect(ELITE_ZOMBIES.stormcaller.chainJumps).toBeGreaterThanOrEqual(1);
  });

  test('stormcaller_boltCooldown_less_than_stormCooldown', () => {
    expect(ELITE_ZOMBIES.stormcaller.boltCooldown).toBeLessThan(
      ELITE_ZOMBIES.stormcaller.stormCooldown
    );
  });

  // --- corruptor ---

  test('corruptor_curseDamageReduction_is_valid_ratio', () => {
    const val = ELITE_ZOMBIES.corruptor.curseDamageReduction;
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  test('corruptor_healingNegation_is_true', () => {
    expect(ELITE_ZOMBIES.corruptor.healingNegation).toBe(true);
  });

  // --- Color format ---

  test('every_zombie_color_is_valid_hex_string', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(z.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  // --- Names are non-empty strings ---

  test('every_zombie_has_non_empty_name', () => {
    Object.values(ELITE_ZOMBIES).forEach(z => {
      expect(typeof z.name).toBe('string');
      expect(z.name.length).toBeGreaterThan(0);
    });
  });
});
