/**
 * CONFIG MANAGER - Re-export centralise de toutes les configurations
 *
 * Les configurations sont splitees dans lib/server/config/ :
 *   - WeaponConfig.js    : WEAPONS
 *   - ZombieConfig.js    : ZOMBIE_TYPES
 *   - PowerupConfig.js   : POWERUP_TYPES
 *   - ShopConfig.js      : SHOP_ITEMS, LEVEL_UP_UPGRADES
 *   - GameplayConfig.js  : CONFIG, GAMEPLAY_CONSTANTS, INACTIVITY_TIMEOUT, HEARTBEAT_CHECK_INTERVAL
 *
 * Ce fichier assure la retro-compatibilite : tous les imports existants
 * via require('./lib/server/ConfigManager') continuent de fonctionner.
 *
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
