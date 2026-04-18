/**
 * CONFIG MANAGER - Centralised re-export of all game configuration.
 *
 * Config modules live in lib/server/config/:
 *   - WeaponConfig.js    → WEAPONS
 *   - ZombieConfig.js    → ZOMBIE_TYPES
 *   - PowerupConfig.js   → POWERUP_TYPES
 *   - ShopConfig.js      → SHOP_ITEMS, LEVEL_UP_UPGRADES
 *   - GameplayConfig.js  → CONFIG, GAMEPLAY_CONSTANTS, INACTIVITY_TIMEOUT, HEARTBEAT_CHECK_INTERVAL
 *
 * Also exposes `configHotReload` (singleton ConfigHotReload) for runtime .env
 * watching. Call configHotReload.watch() once at server startup; listen to the
 * 'reload' event to react to config changes without restarting the process.
 *
 * @example
 *   const { CONFIG, configHotReload } = require('./ConfigManager');
 *   configHotReload.watch();
 *   configHotReload.on('reload', updated => console.log('Config reloaded', updated));
 *
 * @module ConfigManager
 * @version 2.0.0
 */

const { WEAPONS } = require('./config/WeaponConfig');
const { ZOMBIE_TYPES } = require('./config/ZombieConfig');
const { POWERUP_TYPES } = require('./config/PowerupConfig');
const { LEVEL_UP_UPGRADES, SHOP_ITEMS } = require('./config/ShopConfig');
const {
  CONFIG,
  INACTIVITY_TIMEOUT,
  HEARTBEAT_CHECK_INTERVAL,
  GAMEPLAY_CONSTANTS
} = require('./config/GameplayConfig');

const configHotReload = require('./ConfigHotReload');

module.exports = {
  CONFIG,
  WEAPONS,
  POWERUP_TYPES,
  ZOMBIE_TYPES,
  LEVEL_UP_UPGRADES,
  SHOP_ITEMS,
  INACTIVITY_TIMEOUT,
  HEARTBEAT_CHECK_INTERVAL,
  GAMEPLAY_CONSTANTS,
  configHotReload
};
