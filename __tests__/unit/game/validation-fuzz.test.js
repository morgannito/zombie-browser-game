'use strict';

/**
 * Fuzzing minimaliste pour les fonctions de validation.
 * Invariant global : aucune fonction ne throw jamais.
 * Retourne null ou un objet validé — jamais une exception.
 */

const {
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
} = require('../../../game/validationFunctions');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ITERATIONS = 50;

/** Génère un payload aléatoire parmi les types dangereux */
function randomPayload(depth = 0) {
  const pick = Math.floor(Math.random() * 20);
  if (pick === 0) {
return null;
}
  if (pick === 1) {
return undefined;
}
  if (pick === 2) {
return Symbol('fuzz');
}
  if (pick === 3) {
return [];
}
  if (pick === 4) {
return [1, 2, 3];
}
  if (pick === 5) {
return '';
}
  if (pick === 6) {
return 0;
}
  if (pick === 7) {
return NaN;
}
  if (pick === 8) {
return Infinity;
}
  if (pick === 9) {
return -Infinity;
}
  if (pick === 10) {
return true;
}
  if (pick === 11) {
return () => {};
}
  if (pick === 12) {
return new Proxy({}, {});
}
  if (pick === 13) {
return Object.create(null);
} // no prototype
  if (pick === 14) {
    const o = {};
    o.self = o; // circular
    return o;
  }
  if (pick === 15 && depth < 3) {
    // deep nested
    return { a: { b: { c: randomPayload(depth + 1) } } };
  }
  if (pick === 16) {
return { x: NaN, y: NaN, angle: NaN };
}
  if (pick === 17) {
return { x: 'evil', y: {}, angle: [] };
}
  if (pick === 18) {
return new Date();
}
  // plain object with random numeric fields
  return {
    x: (Math.random() - 0.5) * 1e9,
    y: (Math.random() - 0.5) * 1e9,
    angle: (Math.random() - 0.5) * 1e9,
    upgradeId: Math.random() > 0.5 ? 'damageBoost' : 'INVALID_' + Math.random(),
    itemId: Math.random() > 0.5 ? 'maxHealth' : 'INVALID_' + Math.random(),
    category: Math.random() > 0.5 ? 'permanent' : 'evil'
  };
}

/** Retourne true si la valeur est null ou un objet plain (pas de throw) */
function isNullOrPlainObject(val) {
  if (val === null) {
return true;
}
  return typeof val === 'object' && !Array.isArray(val);
}

function runFuzz(fn, label) {
  describe(`${label} — fuzz invariants`, () => {
    test(`test_${label}_randomPayloads_neverThrows`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const payload = randomPayload();
        // Arrange + Act
        let result;
        let threw = false;
        try {
          result = fn(payload);
        } catch {
          threw = true;
        }
        // Assert
        expect(threw).toBe(false);
      }
    });

    test(`test_${label}_randomPayloads_returnsNullOrObject`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const payload = randomPayload();
        // Arrange + Act
        const result = fn(payload);
        // Assert
        expect(isNullOrPlainObject(result)).toBe(true);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Cas spéciaux ciblés (non-aléatoires) pour les types les plus dangereux
// ---------------------------------------------------------------------------

const DANGEROUS_INPUTS = [
  null,
  undefined,
  Symbol('x'),
  [],
  [null],
  '',
  0,
  NaN,
  Infinity,
  -Infinity,
  true,
  false,
  () => {},
  new Proxy({}, {}),
  Object.create(null),
  new Date(),
  { x: null, y: null, angle: null },
  { x: [], y: {}, angle: Symbol() },
  { upgradeId: null },
  { upgradeId: [], category: {} },
  { itemId: Symbol(), category: 'permanent' }
];

describe('validateMovementData — dangerous inputs never throw', () => {
  test.each(DANGEROUS_INPUTS)('test_validateMovementData_dangerous_%#_neverThrows', (input) => {
    // Arrange + Act + Assert
    expect(() => validateMovementData(input)).not.toThrow();
  });

  test.each(DANGEROUS_INPUTS)('test_validateMovementData_dangerous_%#_returnsNullOrObject', (input) => {
    const result = validateMovementData(input);
    expect(isNullOrPlainObject(result)).toBe(true);
  });
});

describe('validateShootData — dangerous inputs never throw', () => {
  test.each(DANGEROUS_INPUTS)('test_validateShootData_dangerous_%#_neverThrows', (input) => {
    expect(() => validateShootData(input)).not.toThrow();
  });

  test.each(DANGEROUS_INPUTS)('test_validateShootData_dangerous_%#_returnsNullOrObject', (input) => {
    const result = validateShootData(input);
    expect(isNullOrPlainObject(result)).toBe(true);
  });
});

describe('validateUpgradeData — dangerous inputs never throw', () => {
  test.each(DANGEROUS_INPUTS)('test_validateUpgradeData_dangerous_%#_neverThrows', (input) => {
    expect(() => validateUpgradeData(input)).not.toThrow();
  });

  test.each(DANGEROUS_INPUTS)('test_validateUpgradeData_dangerous_%#_returnsNullOrObject', (input) => {
    const result = validateUpgradeData(input);
    expect(isNullOrPlainObject(result)).toBe(true);
  });
});

describe('validateBuyItemData — dangerous inputs never throw', () => {
  test.each(DANGEROUS_INPUTS)('test_validateBuyItemData_dangerous_%#_neverThrows', (input) => {
    expect(() => validateBuyItemData(input)).not.toThrow();
  });

  test.each(DANGEROUS_INPUTS)('test_validateBuyItemData_dangerous_%#_returnsNullOrObject', (input) => {
    const result = validateBuyItemData(input);
    expect(isNullOrPlainObject(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fuzz aléatoire 50 itérations par fonction
// ---------------------------------------------------------------------------

runFuzz(validateMovementData, 'validateMovementData');
runFuzz(validateShootData, 'validateShootData');
runFuzz(validateUpgradeData, 'validateUpgradeData');
runFuzz(validateBuyItemData, 'validateBuyItemData');
