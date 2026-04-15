/**
 * @fileoverview Socket.IO server factory.
 * @description Encapsulates the Socket.IO configuration previously inlined in
 * server.js. Keeps protocol choices (transports, ping timing, CF-friendly
 * compression settings) in one place.
 */

const { getSocketIOCorsConfig } = require('../middleware/cors');

/**
 * Build the Socket.IO server bound to an http.Server instance.
 *
 * - `transports: ['websocket', 'polling']` + `allowUpgrades: true` — WS
 *   preferred, polling as fallback.
 * - `pingInterval` / `pingTimeout` tuned for mobile/wifi volatility (20s
 *   timeout vs the default 5s that was causing spurious disconnects).
 * - `perMessageDeflate: false` — Cloudflare strips the extension headers
 *   during the upgrade handshake; leaving it on makes the edge drop the
 *   request with HTTP 400. Re-enable only on direct or CF-compatible CDNs.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function createSocketIOServer(httpServer) {
  // Lazy-load to avoid circular init when tests mock the module.
  const io = require('socket.io')(httpServer, {
    cors: getSocketIOCorsConfig(),
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingInterval: 10000,
    pingTimeout: 20000,
    connectTimeout: 45000,
    // Activé par défaut, désactivable pour Cloudflare via env DISABLE_WS_COMPRESSION=true
    perMessageDeflate: process.env.DISABLE_WS_COMPRESSION === 'true' ? false : { threshold: 1024 },
    httpCompression: true,
    maxHttpBufferSize: 1e6
  });
  return io;
}

module.exports = { createSocketIOServer };
