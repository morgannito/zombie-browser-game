/**
 * @fileoverview Tests for validation functions
 */

const {
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
} = require('../game/validationFunctions');

describe('Validation Functions', () => {
  describe('validateMovementData', () => {
    test('should accept valid movement data', () => {
      const validData = {
        x: 500,
        y: 300,
        angle: 1.5
      };

      const result = validateMovementData(validData);
      expect(result).not.toBeNull();
      expect(result.x).toBe(500);
      expect(result.y).toBe(300);
      expect(result.angle).toBe(1.5);
    });

    test('should reject x coordinate out of bounds', () => {
      const invalidData = {
        x: -100, // Negative x
        y: 300,
        angle: 1.5
      };

      const result = validateMovementData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject missing fields', () => {
      const invalidData = {
        x: 500,
        // Missing y and angle
      };

      const result = validateMovementData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject non-numeric values', () => {
      const invalidData = {
        x: 'not a number',
        y: 300,
        angle: 1.5
      };

      const result = validateMovementData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject extra unknown fields', () => {
      const invalidData = {
        x: 500,
        y: 300,
        angle: 1.5,
        maliciousField: 'attack'
      };

      const result = validateMovementData(invalidData);
      expect(result).toBeNull();
    });
  });

  describe('validateShootData', () => {
    test('should accept valid shoot data', () => {
      const validData = {
        angle: Math.PI / 2
      };

      const result = validateShootData(validData);
      expect(result).not.toBeNull();
      expect(result.angle).toBe(Math.PI / 2);
    });

    test('should reject angle out of range', () => {
      const invalidData = {
        angle: Math.PI * 3 // Too large
      };

      const result = validateShootData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject missing angle', () => {
      const invalidData = {};

      const result = validateShootData(invalidData);
      expect(result).toBeNull();
    });
  });

  describe('validateUpgradeData', () => {
    test('should accept valid upgrade ID', () => {
      const validData = {
        upgradeId: 'damageBoost'
      };

      const result = validateUpgradeData(validData);
      expect(result).not.toBeNull();
      expect(result.upgradeId).toBe('damageBoost');
    });

    test('should reject unknown upgrade ID', () => {
      const invalidData = {
        upgradeId: 'nonExistentUpgrade'
      };

      const result = validateUpgradeData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject missing upgradeId', () => {
      const invalidData = {};

      const result = validateUpgradeData(invalidData);
      expect(result).toBeNull();
    });
  });

  describe('validateBuyItemData', () => {
    test('should accept valid permanent item', () => {
      const validData = {
        itemId: 'maxHealth',
        category: 'permanent'
      };

      const result = validateBuyItemData(validData);
      expect(result).not.toBeNull();
      expect(result.itemId).toBe('maxHealth');
      expect(result.category).toBe('permanent');
    });

    test('should reject invalid category', () => {
      const invalidData = {
        itemId: 'maxHealth',
        category: 'invalid'
      };

      const result = validateBuyItemData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject unknown item ID', () => {
      const invalidData = {
        itemId: 'nonExistentItem',
        category: 'permanent'
      };

      const result = validateBuyItemData(invalidData);
      expect(result).toBeNull();
    });

    test('should reject missing fields', () => {
      const invalidData = {
        itemId: 'maxHealth'
        // Missing category
      };

      const result = validateBuyItemData(invalidData);
      expect(result).toBeNull();
    });
  });
});
