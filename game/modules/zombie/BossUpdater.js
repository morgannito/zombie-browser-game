/**
 * @fileoverview Boss zombie updaters - Main entry point
 * @description Delegates to specialized boss updaters
 */

const { updateBossCharnier, updateBossInfect, updateBossColosse, updateBossRoi, updateBossOmega } = require('./BossUpdaterSimple');
const { updateBossInfernal, updateBossCryos, updateBossVortex, updateBossNexus, updateBossApocalypse } = require('./BossAbilities');

module.exports = {
  // Original bosses
  updateBossCharnier,
  updateBossInfect,
  updateBossColosse,
  updateBossRoi,
  updateBossOmega,

  // New extended bosses
  updateBossInfernal,
  updateBossCryos,
  updateBossVortex,
  updateBossNexus,
  updateBossApocalypse
};
