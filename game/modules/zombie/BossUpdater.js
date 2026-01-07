/**
 * @fileoverview Boss zombie updaters - Main entry point
 * @description Delegates to specialized boss updaters
 */

const { updateBossCharnier, updateBossInfect, updateBossColosse, updateBossRoi, updateBossOmega } = require('./BossUpdaterSimple');

module.exports = {
  updateBossCharnier,
  updateBossInfect,
  updateBossColosse,
  updateBossRoi,
  updateBossOmega
};
