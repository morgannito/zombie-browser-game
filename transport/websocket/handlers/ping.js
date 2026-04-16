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
 * Optional second argument `reportedLatency` (ms) is stored on the shared
 * NetworkManager so the broadcast loop can throttle per-socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {object} [networkManager] — lib/server/NetworkManager instance (optional)
 */
function registerPingHandler(socket, networkManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PING,
    safeHandler('ping', function (_timestamp, reportedLatency, callback) {
      // Back-compat: old clients pass (timestamp, callback) without latency.
      if (typeof reportedLatency === 'function') {
        callback = reportedLatency;
        reportedLatency = null;
      }
      if (
        networkManager &&
        typeof reportedLatency === 'number' &&
        reportedLatency >= 0 &&
        reportedLatency < 10000
      ) {
        networkManager.playerLatencies[socket.id] = {
          latency: reportedLatency,
          lastPing: Date.now()
        };
      }
      if (typeof callback === 'function') {
        callback(Date.now());
      }
    })
  );
}

module.exports = { registerPingHandler };
