/**
 * DOMAIN INVARIANTS - Shared validation helpers
 * Pure functions, no side effects, no dependencies.
 */

/**
 * @param {*} value
 * @param {string} name
 * @throws {Error} if value is falsy
 */
function requirePresence(value, name) {
  if (!value) throw new Error(`${name} is required`);
}

/**
 * @param {number} value
 * @param {string} name
 * @throws {Error} if value < 0
 */
function requireNonNegative(value, name) {
  if (value < 0) throw new Error(`${name} must be >= 0`);
}

/**
 * @param {number} value
 * @param {string} name
 * @throws {Error} if value < 1
 */
function requirePositive(value, name) {
  if (value < 1) throw new Error(`${name} must be >= 1`);
}

/**
 * @param {number} value
 * @param {string} name
 * @param {number} min
 * @param {number} max
 * @throws {Error} if value out of range
 */
function requireRange(value, name, min, max) {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

module.exports = { requirePresence, requireNonNegative, requirePositive, requireRange };
