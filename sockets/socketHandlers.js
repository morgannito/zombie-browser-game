/**
 * @fileoverview Back-compat shim — the canonical entry-point now lives at
 * `transport/websocket/index.js`. This file is kept for any consumer that
 * still imports `sockets/socketHandlers`; new code should require
 * `../transport/websocket` instead.
 */

module.exports = require('../transport/websocket');
