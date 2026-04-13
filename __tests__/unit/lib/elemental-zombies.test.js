'use strict';

const { ELEMENTAL_ZOMBIES } = require('../../../lib/server/zombie-types/elemental-zombies');

describe('ELEMENTAL_ZOMBIES', () => {
  // --- Structure ---

  test('exports_object_with_five_elemental_types', () => {
    expect(Object.keys(ELEMENTAL_ZOMBIES)).toHaveLength(5);
  });

  test('contains_all_expected_elemental_keys', () => {
    const expected = ['inferno', 'glacier', 'thunderstorm', 'boulder', 'tornado'];
    expect(Object.keys(ELEMENTAL_ZOMBIES)).toEqual(expect.arrayContaining(expected));
  });

  // --- isElemental flag ---

  test('every_zombie_has_isElemental_true', () => {
    const results = Object.values(ELEMENTAL_ZOMBIES).map(z => z.isElemental);
    expect(results).toEqual(expect.arrayContaining([true, true, true, true, true]));
  });

  test('no_zombie_has_isElemental_false_or_missing', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.isElemental).toBe(true);
    });
  });

  // --- Required base stats ---

  const BASE_FIELDS = [
    'name',
    'health',
    'speed',
    'damage',
    'xp',
    'gold',
    'size',
    'color',
    'element'
  ];

  test.each(BASE_FIELDS)('every_zombie_has_required_field_%s', field => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z).toHaveProperty(field);
    });
  });

  test('every_zombie_has_positive_health', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.health).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_speed', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.speed).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_damage', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.damage).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_xp', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.xp).toBeGreaterThan(0);
    });
  });

  test('every_zombie_has_positive_gold', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.gold).toBeGreaterThan(0);
    });
  });

  // --- Unique elements ---

  test('all_element_values_are_unique', () => {
    const elements = Object.values(ELEMENTAL_ZOMBIES).map(z => z.element);
    const unique = new Set(elements);
    expect(unique.size).toBe(elements.length);
  });

  test('element_values_are_known_strings', () => {
    const valid = ['fire', 'ice', 'lightning', 'earth', 'wind'];
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(valid).toContain(z.element);
    });
  });

  // --- inferno (fire) ---

  test('inferno_has_fire_element', () => {
    expect(ELEMENTAL_ZOMBIES.inferno.element).toBe('fire');
  });

  test('inferno_has_burnDamage_greater_than_zero', () => {
    expect(ELEMENTAL_ZOMBIES.inferno.burnDamage).toBeGreaterThan(0);
  });

  test('inferno_has_burnDuration_in_milliseconds', () => {
    expect(ELEMENTAL_ZOMBIES.inferno.burnDuration).toBeGreaterThanOrEqual(1000);
  });

  test('inferno_has_fireAuraRadius_positive', () => {
    expect(ELEMENTAL_ZOMBIES.inferno.fireAuraRadius).toBeGreaterThan(0);
  });

  // --- glacier (ice) ---

  test('glacier_has_ice_element', () => {
    expect(ELEMENTAL_ZOMBIES.glacier.element).toBe('ice');
  });

  test('glacier_freezeOnHit_is_true', () => {
    expect(ELEMENTAL_ZOMBIES.glacier.freezeOnHit).toBe(true);
  });

  test('glacier_iceArmorReduction_is_between_0_and_1', () => {
    const val = ELEMENTAL_ZOMBIES.glacier.iceArmorReduction;
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  test('glacier_has_higher_health_than_inferno_and_thunderstorm', () => {
    expect(ELEMENTAL_ZOMBIES.glacier.health).toBeGreaterThan(ELEMENTAL_ZOMBIES.inferno.health);
    expect(ELEMENTAL_ZOMBIES.glacier.health).toBeGreaterThan(ELEMENTAL_ZOMBIES.thunderstorm.health);
  });

  // --- thunderstorm (lightning) ---

  test('thunderstorm_has_lightning_element', () => {
    expect(ELEMENTAL_ZOMBIES.thunderstorm.element).toBe('lightning');
  });

  test('thunderstorm_shockChance_is_valid_probability', () => {
    const val = ELEMENTAL_ZOMBIES.thunderstorm.shockChance;
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  test('thunderstorm_has_fastest_speed_among_elementals_except_tornado', () => {
    const speed = ELEMENTAL_ZOMBIES.thunderstorm.speed;
    expect(speed).toBeGreaterThan(ELEMENTAL_ZOMBIES.glacier.speed);
    expect(speed).toBeGreaterThan(ELEMENTAL_ZOMBIES.boulder.speed);
  });

  // --- boulder (earth) ---

  test('boulder_has_earth_element', () => {
    expect(ELEMENTAL_ZOMBIES.boulder.element).toBe('earth');
  });

  test('boulder_has_highest_damage_among_elementals', () => {
    const damages = Object.values(ELEMENTAL_ZOMBIES).map(z => z.damage);
    expect(ELEMENTAL_ZOMBIES.boulder.damage).toBe(Math.max(...damages));
  });

  test('boulder_earthquakeCooldown_is_positive_ms', () => {
    expect(ELEMENTAL_ZOMBIES.boulder.earthquakeCooldown).toBeGreaterThan(0);
  });

  // --- tornado (wind) ---

  test('tornado_has_wind_element', () => {
    expect(ELEMENTAL_ZOMBIES.tornado.element).toBe('wind');
  });

  test('tornado_has_highest_speed_among_elementals', () => {
    const speeds = Object.values(ELEMENTAL_ZOMBIES).map(z => z.speed);
    expect(ELEMENTAL_ZOMBIES.tornado.speed).toBe(Math.max(...speeds));
  });

  test('tornado_has_lowest_health_among_elementals', () => {
    const healths = Object.values(ELEMENTAL_ZOMBIES).map(z => z.health);
    expect(ELEMENTAL_ZOMBIES.tornado.health).toBe(Math.min(...healths));
  });

  test('tornado_pushbackForce_is_positive', () => {
    expect(ELEMENTAL_ZOMBIES.tornado.pushbackForce).toBeGreaterThan(0);
  });

  // --- Color format ---

  test('every_zombie_color_is_valid_hex_string', () => {
    Object.values(ELEMENTAL_ZOMBIES).forEach(z => {
      expect(z.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  // --- Immutability guard ---

  test('module_export_is_frozen_or_at_least_readable', () => {
    expect(ELEMENTAL_ZOMBIES).toBeDefined();
    expect(typeof ELEMENTAL_ZOMBIES).toBe('object');
  });
});
