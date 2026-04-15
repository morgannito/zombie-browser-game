/**
 * @fileoverview Spawn-protection handler.
 * @description Lets the client explicitly end the post-spawn invulnerability
 * window (e.g. after a short aim). Third slice of the socketHandlers split.
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');
const logger = require('../../../infrastructure/logging/Logger');

/**
 * Register the spawn-protection handler on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Object} gameState
 */
function registerSpawnProtectionHandlers(socket, gameState) {
  socket.on(
    SOCKET_EVENTS.CLIENT.END_SPAWN_PROTECTION,
    safeHandler('endSpawnProtection', function () {
      const player = gameState.players[socket.id];
      if (!player || !player.hasNickname) {
        return;
      }

      player.lastActivityTime = Date.now();
      player.spawnProtection = false;
      logger.info('Spawn protection ended', { player: player.nickname || socket.id });
    })
  );
}

module.exports = { registerSpawnProtectionHandlers };
