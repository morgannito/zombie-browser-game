'use strict';

const {
  isValidNumber,
  isValidString,
  isPlainObject,
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
} = require('../../../game/validationFunctions');

const ConfigManager = require('../../../lib/server/ConfigManager');
const { CONFIG, LEVEL_UP_UPGRADES, SHOP_ITEMS } = ConfigManager;

// Pick a valid upgradeId and shop item from actual config
const VALID_UPGRADE_ID = Object.keys(LEVEL_UP_UPGRADES)[0];
const VALID_SHOP_CATEGORY = 'permanent';
const VALID_SHOP_ITEM_ID = Object.keys(SHOP_ITEMS[VALID_SHOP_CATEGORY])[0];

describe('validationFunctions', () => {
  // isPlainObject
  describe('isPlainObject', () => {
    test('plain object returns true', () => {
      expect(isPlainObject({ a: 1 })).toBe(true);
    });
    test('array returns false', () => {
      expect(isPlainObject([1, 2, 3])).toBe(false);
    });
    test('null returns false', () => {
      expect(isPlainObject(null)).toBe(false);
    });
    test('string returns false', () => {
      expect(isPlainObject('str')).toBe(false);
    });
  });

  // isValidNumber
  describe('isValidNumber', () => {
    test('test_isValidNumber_regularNumber_returnsTrue', () => {
      expect(isValidNumber(42)).toBe(true);
    });

    test('test_isValidNumber_NaN_returnsFalse', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });

    test('test_isValidNumber_Infinity_returnsFalse', () => {
      expect(isValidNumber(Infinity)).toBe(false);
    });

    test('test_isValidNumber_string_returnsFalse', () => {
      expect(isValidNumber('10')).toBe(false);
    });

    test('test_isValidNumber_belowMin_returnsFalse', () => {
      expect(isValidNumber(-1, 0, 100)).toBe(false);
    });

    test('test_isValidNumber_aboveMax_returnsFalse', () => {
      expect(isValidNumber(101, 0, 100)).toBe(false);
    });

    test('test_isValidNumber_atBounds_returnsTrue', () => {
      expect(isValidNumber(0, 0, 100)).toBe(true);
      expect(isValidNumber(100, 0, 100)).toBe(true);
    });
  });

  // isValidString
  describe('isValidString', () => {
    test('test_isValidString_normalString_returnsTrue', () => {
      expect(isValidString('hello')).toBe(true);
    });

    test('test_isValidString_emptyString_returnsFalse', () => {
      expect(isValidString('')).toBe(false);
    });

    test('test_isValidString_tooLong_returnsFalse', () => {
      expect(isValidString('a'.repeat(101), 100)).toBe(false);
    });

    test('test_isValidString_number_returnsFalse', () => {
      expect(isValidString(123)).toBe(false);
    });

    test('test_isValidString_exactMaxLength_returnsTrue', () => {
      expect(isValidString('a'.repeat(100), 100)).toBe(true);
    });
  });

  // validateMovementData
  describe('validateMovementData', () => {
    test('test_validateMovementData_validData_returnsObject', () => {
      const data = { x: 100, y: 100, angle: 0 };
      expect(validateMovementData(data)).toEqual(data);
    });

    test('test_validateMovementData_null_returnsNull', () => {
      expect(validateMovementData(null)).toBeNull();
    });

    test('test_validateMovementData_nonObject_returnsNull', () => {
      expect(validateMovementData('string')).toBeNull();
    });

    test('test_validateMovementData_xOutOfBounds_returnsNull', () => {
      const data = { x: CONFIG.ROOM_WIDTH + 1, y: 100, angle: 0 };
      expect(validateMovementData(data)).toBeNull();
    });

    test('test_validateMovementData_yOutOfBounds_returnsNull', () => {
      const data = { x: 100, y: CONFIG.ROOM_HEIGHT + 1, angle: 0 };
      expect(validateMovementData(data)).toBeNull();
    });

    test('test_validateMovementData_angleOutOfBounds_returnsNull', () => {
      const data = { x: 100, y: 100, angle: Math.PI * 3 };
      expect(validateMovementData(data)).toBeNull();
    });

    test('test_validateMovementData_array_returnsNull', () => {
      const arr = [];
      arr.x = 100; arr.y = 100; arr.angle = 0;
      expect(validateMovementData(arr)).toBeNull();
    });

    // Guard: angle must be within [-π, π] (not ±2π)
    test('test_validateMovementData_angleBetweenPiAnd2Pi_returnsNull', () => {
      expect(validateMovementData({ x: 100, y: 100, angle: Math.PI + 0.1 })).toBeNull();
    });

    // Guard: NaN coordinates rejected
    test('test_validateMovementData_NaNX_returnsNull', () => {
      expect(validateMovementData({ x: NaN, y: 100, angle: 0 })).toBeNull();
    });

    test('test_validateMovementData_returnsOnlyExpectedFields', () => {
      const data = { x: 50, y: 50, angle: 1, extra: 'ignored' };
      const result = validateMovementData(data);
      expect(Object.keys(result)).toEqual(['x', 'y', 'angle']);
    });
  });

  // validateShootData
  describe('validateShootData', () => {
    test('test_validateShootData_validAngle_returnsObject', () => {
      expect(validateShootData({ angle: 1.5 })).toEqual({ angle: 1.5 });
    });

    test('test_validateShootData_null_returnsNull', () => {
      expect(validateShootData(null)).toBeNull();
    });

    test('test_validateShootData_angleOutOfBounds_returnsNull', () => {
      expect(validateShootData({ angle: 100 })).toBeNull();
    });

    test('test_validateShootData_missingAngle_returnsNull', () => {
      expect(validateShootData({})).toBeNull();
    });

    // Guard: angle must be within [-π, π]
    test('test_validateShootData_angleAbovePi_returnsNull', () => {
      expect(validateShootData({ angle: Math.PI + 0.1 })).toBeNull();
    });

    // Guard: optional x/y must be within room bounds
    test('test_validateShootData_xBeyondRoomWidth_dropsOptionalCoords', () => {
      const result = validateShootData({ angle: 1.0, x: CONFIG.ROOM_WIDTH + 1, y: 100 });
      expect(result).toEqual({ angle: 1.0 });
      expect(result.x).toBeUndefined();
    });

    // Guard: NaN angle rejected
    test('test_validateShootData_NaNAngle_returnsNull', () => {
      expect(validateShootData({ angle: NaN })).toBeNull();
    });
  });

  // validateUpgradeData
  describe('validateUpgradeData', () => {
    test('test_validateUpgradeData_validUpgradeId_returnsObject', () => {
      expect(validateUpgradeData({ upgradeId: VALID_UPGRADE_ID })).toEqual({
        upgradeId: VALID_UPGRADE_ID
      });
    });

    test('test_validateUpgradeData_unknownUpgradeId_returnsNull', () => {
      expect(validateUpgradeData({ upgradeId: 'nonExistentUpgrade_xyz' })).toBeNull();
    });

    test('test_validateUpgradeData_null_returnsNull', () => {
      expect(validateUpgradeData(null)).toBeNull();
    });

    test('test_validateUpgradeData_missingUpgradeId_returnsNull', () => {
      expect(validateUpgradeData({})).toBeNull();
    });
  });

  // validateBuyItemData
  describe('validateBuyItemData', () => {
    test('test_validateBuyItemData_validPermanentItem_returnsObject', () => {
      const result = validateBuyItemData({
        itemId: VALID_SHOP_ITEM_ID,
        category: VALID_SHOP_CATEGORY
      });
      expect(result).toEqual({ itemId: VALID_SHOP_ITEM_ID, category: VALID_SHOP_CATEGORY });
    });

    test('test_validateBuyItemData_invalidCategory_returnsNull', () => {
      expect(validateBuyItemData({ itemId: VALID_SHOP_ITEM_ID, category: 'unknown' })).toBeNull();
    });

    test('test_validateBuyItemData_unknownItemId_returnsNull', () => {
      expect(validateBuyItemData({ itemId: 'fakeItem', category: VALID_SHOP_CATEGORY })).toBeNull();
    });

    test('test_validateBuyItemData_array_returnsNull', () => {
      const arr = [];
      arr.itemId = VALID_SHOP_ITEM_ID;
      arr.category = VALID_SHOP_CATEGORY;
      expect(validateBuyItemData(arr)).toBeNull();
    });

    test('test_validateBuyItemData_null_returnsNull', () => {
      expect(validateBuyItemData(null)).toBeNull();
    });

    test('test_validateBuyItemData_missingFields_returnsNull', () => {
      expect(validateBuyItemData({ itemId: VALID_SHOP_ITEM_ID })).toBeNull();
    });
  });
});
