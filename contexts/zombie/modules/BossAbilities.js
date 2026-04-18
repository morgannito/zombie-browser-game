/**
 * @fileoverview Boss Abilities System — dispatcher
 * @description Délègue aux sous-modules par boss type.
 */

const { updateBossInfernal } = require('./bosses/bossInfernal');
const { updateBossCryos } = require('./bosses/bossCryos');
const { updateBossVortex } = require('./bosses/bossVortex');
const { updateBossNexus } = require('./bosses/bossNexus');
const { updateBossApocalypse } = require('./bosses/bossApocalypse');

module.exports = {
  updateBossInfernal,
  updateBossCryos,
  updateBossVortex,
  updateBossNexus,
  updateBossApocalypse
};
