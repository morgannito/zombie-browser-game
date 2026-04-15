/**
 * @fileoverview WebSocket transport entry-point.
 * @description Canonical export location for the Socket.IO bootstrap.
 *
 * The `initSocketHandlers` function body still lives in
 * `sockets/socketHandlers.js` and is re-exported here for now. A follow-up
 * iter will move the bootstrap body into this file once every other
 * handler-body has migrated to `transport/websocket/handlers/` (setNickname
 * and disconnect are in-flight PRs).
 *
 * Consumers SHOULD import from this path going forward; the old
 * `sockets/socketHandlers` path remains as a back-compat shim.
 */

const {
  initSocketHandlers,
  stopSessionCleanupInterval
} = require('../../sockets/socketHandlers');

module.exports = {
  initSocketHandlers,
  stopSessionCleanupInterval
};
