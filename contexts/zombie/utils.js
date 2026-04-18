/**
 * Returns the numeric mutator effect for a given key, or fallback if absent.
 * @param {object} gameState
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function getMutatorEffect(gameState, key, fallback = 1) {
  const effects = gameState.mutatorEffects || {};
  const value = effects[key];
  return typeof value === 'number' ? value : fallback;
}

module.exports = { getMutatorEffect };
