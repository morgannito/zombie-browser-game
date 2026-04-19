/**
 * Feature flags configuration.
 * Toggle game systems on/off without code changes.
 * Override via environment: FEATURE_GEMS=false
 */

const FEATURES = {
  // Core gameplay
  achievements: envBool('FEATURE_ACHIEVEMENTS', true),
  dailyChallenges: envBool('FEATURE_DAILY_CHALLENGES', true),
  leaderboard: envBool('FEATURE_LEADERBOARD', true),

  // Monetization / Retention
  gemSystem: envBool('FEATURE_GEMS', true),
  contracts: envBool('FEATURE_CONTRACTS', true),
  missions: envBool('FEATURE_MISSIONS', true),
  retentionHooks: envBool('FEATURE_RETENTION', true),

  // Visual
  weatherSystem: envBool('FEATURE_WEATHER', true),
  dayNightCycle: envBool('FEATURE_DAYNIGHT', true),
  biomeSystem: envBool('FEATURE_BIOMES', true),

  // Advanced
  telemetry: envBool('FEATURE_TELEMETRY', true),
  runMutators: envBool('FEATURE_MUTATORS', true),
  riskReward: envBool('FEATURE_RISK_REWARD', true),

  // Debug
  adminPanel: envBool('FEATURE_ADMIN', process.env.NODE_ENV !== 'production')
};

/**
 * Parse an environment variable as a boolean.
 * @param {string} key - Environment variable name
 * @param {boolean} defaultValue - Fallback when env var is not set
 * @returns {boolean}
 */
function envBool(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined) {
    return defaultValue;
  }
  return val === 'true' || val === '1';
}

/**
 * Get a snapshot of all feature flags.
 * @returns {Object} Shallow copy of FEATURES
 */
function getAll() {
  return { ...FEATURES };
}

module.exports = { getAll };
