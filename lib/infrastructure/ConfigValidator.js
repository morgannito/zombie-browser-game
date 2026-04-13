/**
 * @fileoverview Startup config validator — fail-fast orchestrator
 * @description Validates all game configs at boot. Call once before server starts.
 * Each sub-validator exits with code 1 and a clear message on failure.
 */

const { validateEnv } = require('./EnvValidator');

/**
 * Validates all application configs. Fails fast with clear error messages.
 * Env validation runs explicitly; game configs self-validate on require.
 * @returns {Object} Validated env values
 */
function validateAllConfigs() {
  const env = validateEnv();

  // Trigger self-validating config modules (process.exit on invalid data)
  require('../server/config/ZombieConfig');
  require('../server/config/WeaponConfig');
  require('../server/config/ShopConfig');

  return env;
}

module.exports = { validateAllConfigs };
