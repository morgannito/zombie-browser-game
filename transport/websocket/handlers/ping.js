/**
 * @fileoverview Ping handler — latency monitoring.
 * @description Echoes client timestamps via ack callback for RTT measurement.
 * First extraction from the legacy god-file sockets/socketHandlers.js as part
 * of the transport/websocket/ refactor (see REFACTOR_PLAN.md Phase 1).
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');

/**
 * Register the latency ping handler on a socket.
 * Responds to SOCKET_EVENTS.CLIENT.PING with a Date.now() ack.
 *
 * @param {import('socket.io').Socket} socket
 */
function registerPingHandler(socket) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PING,
    safeHandler('ping', function (_timestamp, callback) {
      if (typeof callback === 'function') {
        callback(Date.now());
      }
    })
  );
}

module.exports = { registerPingHandler };
