'use strict';

/**
 * Regression: MathUtils.circleCollision — edge case r=0
 * Bug: deux points au même endroit avec r=0 ne retournaient pas true
 */

const { circleCollision } = require('../../../lib/MathUtils');

describe('MathUtils.circleCollision — edge cases r=0', () => {
  test('deux_points_identiques_r0_retourne_true', () => {
    expect(circleCollision(5, 5, 0, 5, 5, 0)).toBe(true);
  });

  test('deux_points_differents_r0_retourne_false', () => {
    expect(circleCollision(0, 0, 0, 1, 0, 0)).toBe(false);
  });

  test('r1_zero_r2_nonzero_collision_si_point_dans_cercle', () => {
    expect(circleCollision(5, 5, 0, 5, 5, 10)).toBe(true);
  });

  test('r1_zero_r2_nonzero_pas_collision_si_hors_cercle', () => {
    expect(circleCollision(0, 0, 0, 20, 0, 5)).toBe(false);
  });

  test('r1_zero_r2_nonzero_collision_exactement_sur_bord', () => {
    // point à distance 10 du centre, r2=10 → distSq=100 <= radiusSum^2=100
    expect(circleCollision(0, 0, 0, 10, 0, 10)).toBe(true);
  });

  test('deux_cercles_normaux_collision', () => {
    expect(circleCollision(0, 0, 5, 8, 0, 5)).toBe(true);
  });

  test('deux_cercles_normaux_pas_collision', () => {
    expect(circleCollision(0, 0, 3, 10, 0, 3)).toBe(false);
  });
});
