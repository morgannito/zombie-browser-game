/**
 * @fileoverview Player bounded context — public facade.
 * @description Player progression, effects, respawn, special abilities
 *   (auto turret, tesla coil), death handling. Internal modules live in
 *   contexts/player/modules/.
 */

const PlayerManager = require('./PlayerManager');
const { updatePlayers } = require('./modules/PlayerUpdater');

module.exports = { PlayerManager, updatePlayers };
