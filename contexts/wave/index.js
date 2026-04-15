/**
 * @fileoverview Wave bounded context — public facade.
 * @description Wave progression + Rogue-like room management.
 */

const RoomManager = require('./RoomManager');
const { handleNewWave } = require('./modules/WaveManager');

module.exports = { RoomManager, handleNewWave };
