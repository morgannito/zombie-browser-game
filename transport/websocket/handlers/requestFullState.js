/**
 * @fileoverview requestFullState handler — reconnect resync.
 * @description Re-emits the full INIT + GAME_STATE snapshot to a reconnecting
 * client that already has a live socket but whose local state is stale.
 * Triggered by SOCKET_EVENTS.CLIENT.REQUEST_FULL_STATE (emitted by
 * NetworkManager._syncFullState on reconnect).
 *
 * emitInitSnapshot is injected as a dependency to avoid a circular require
 * with transport/websocket/index.js.
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');
const logger = require('../../../infrastructure/logging/Logger');

/**
 * @param {import('socket.io').Socket} socket
 * @param {object} gameState
 * @param {Function} emitInitSnapshot  — injected from index.js to avoid circular dep
 */
function registerRequestFullStateHandler(socket, gameState, emitInitSnapshot) {
  socket.on(
    SOCKET_EVENTS.CLIENT.REQUEST_FULL_STATE,
    safeHandler('requestFullState', function () {
      if (!gameState.players[socket.id]) {
        return;
      }
      logger.debug('requestFullState', { socketId: socket.id, traceId: socket.traceId || null });
      emitInitSnapshot(socket, gameState, true);
    })
  );
}

module.exports = { registerRequestFullStateHandler };
