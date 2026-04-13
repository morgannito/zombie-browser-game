'use strict';

const {
  fastCos,
  fastSin,
  distanceSquared,
  distance,
  circleCollision,
  lerp,
  clamp,
  normalizeAngle,
  randomInt,
  randomFloat
} = require('../../../lib/MathUtils');

describe('MathUtils', () => {
  // fastCos
  describe('fastCos', () => {
    test('test_fastCos_zeroAngle_returnsOne', () => {
      expect(fastCos(0)).toBeCloseTo(1, 1);
    });

    test('test_fastCos_halfPi_returnsNearZero', () => {
      expect(fastCos(Math.PI / 2)).toBeCloseTo(0, 1);
    });

    test('test_fastCos_negativeAngle_normalizesCorrectly', () => {
      expect(fastCos(-Math.PI * 2)).toBeCloseTo(1, 1);
    });
  });

  // fastSin
  describe('fastSin', () => {
    test('test_fastSin_zeroAngle_returnsNearZero', () => {
      expect(fastSin(0)).toBeCloseTo(0, 1);
    });

    test('test_fastSin_halfPi_returnsNearOne', () => {
      expect(fastSin(Math.PI / 2)).toBeCloseTo(1, 1);
    });
  });

  // distanceSquared
  describe('distanceSquared', () => {
    test('test_distanceSquared_samePoint_returnsZero', () => {
      expect(distanceSquared(5, 5, 5, 5)).toBe(0);
    });

    test('test_distanceSquared_knownPoints_returnsCorrectValue', () => {
      expect(distanceSquared(0, 0, 3, 4)).toBe(25);
    });

    test('test_distanceSquared_negativeCoords_returnsPositive', () => {
      expect(distanceSquared(-1, -1, 2, 3)).toBe(25);
    });
  });

  // distance
  describe('distance', () => {
    test('test_distance_threeByFourTriangle_returnsFive', () => {
      expect(distance(0, 0, 3, 4)).toBe(5);
    });

    test('test_distance_samePoint_returnsZero', () => {
      expect(distance(7, 7, 7, 7)).toBe(0);
    });
  });

  // circleCollision
  describe('circleCollision', () => {
    test('test_circleCollision_overlapping_returnsTrue', () => {
      expect(circleCollision(0, 0, 5, 3, 0, 5)).toBe(true);
    });

    test('test_circleCollision_touching_returnsTrue', () => {
      expect(circleCollision(0, 0, 3, 6, 0, 3)).toBe(true);
    });

    test('test_circleCollision_separated_returnsFalse', () => {
      expect(circleCollision(0, 0, 1, 10, 0, 1)).toBe(false);
    });
  });

  // lerp
  describe('lerp', () => {
    test('test_lerp_tZero_returnsA', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    test('test_lerp_tOne_returnsB', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    test('test_lerp_tHalf_returnsMidpoint', () => {
      expect(lerp(10, 20, 0.5)).toBe(15);
    });
  });

  // clamp
  describe('clamp', () => {
    test('test_clamp_valueBelowMin_returnsMin', () => {
      expect(clamp(-5, 0, 100)).toBe(0);
    });

    test('test_clamp_valueAboveMax_returnsMax', () => {
      expect(clamp(200, 0, 100)).toBe(100);
    });

    test('test_clamp_valueInRange_returnsValue', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });
  });

  // normalizeAngle
  describe('normalizeAngle', () => {
    test('test_normalizeAngle_positiveAngle_returnsSameRange', () => {
      const result = normalizeAngle(Math.PI);
      expect(result).toBeCloseTo(Math.PI, 5);
    });

    test('test_normalizeAngle_twoPi_returnsNearZero', () => {
      const result = normalizeAngle(Math.PI * 2);
      expect(result).toBeCloseTo(0, 5);
    });

    test('test_normalizeAngle_negativeAngle_returnsPositive', () => {
      const result = normalizeAngle(-Math.PI);
      expect(result).toBeCloseTo(Math.PI, 5);
    });
  });

  // randomInt
  describe('randomInt', () => {
    test('test_randomInt_range_alwaysWithinBounds', () => {
      for (let i = 0; i < 100; i++) {
        const val = randomInt(3, 7);
        expect(val).toBeGreaterThanOrEqual(3);
        expect(val).toBeLessThanOrEqual(7);
      }
    });

    test('test_randomInt_sameMinMax_returnsExactValue', () => {
      expect(randomInt(5, 5)).toBe(5);
    });
  });

  // randomFloat
  describe('randomFloat', () => {
    test('test_randomFloat_range_alwaysWithinBounds', () => {
      for (let i = 0; i < 100; i++) {
        const val = randomFloat(1.5, 3.5);
        expect(val).toBeGreaterThanOrEqual(1.5);
        expect(val).toBeLessThan(3.5);
      }
    });
  });
});
