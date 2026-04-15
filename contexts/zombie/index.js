/**
 * @fileoverview Zombie bounded context — public facade.
 * @description Exposes the zombie domain surface to the rest of the app.
 *   Internal modules (BossUpdater, SpecialZombieUpdater, ZombieEffects, ...)
 *   stay private; consumers should import only from this entry point or
 *   the explicit ZombieManager / SpatialGrid files.
 */

const ZombieManager = require('./ZombieManager');
const { SpatialGrid } = require('./SpatialGrid');

module.exports = { ZombieManager, SpatialGrid };
