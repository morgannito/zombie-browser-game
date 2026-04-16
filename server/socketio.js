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
    // WS-only: supprime le fallback polling qui ajoute 50-200ms au handshake et double la bande passante en cas de fallback.
    // Les navigateurs modernes + CF supportent WS nativement.
    transports: ['websocket'],
    allowUpgrades: false,
    pingInterval: 10000,
    pingTimeout: 20000,
    connectTimeout: 45000,
    // Désactivé par défaut (Cloudflare strippe WS compression et cause des latences élevées).
    // Activer avec ENABLE_WS_COMPRESSION=true uniquement si proxy direct (sans CF).
    perMessageDeflate: process.env.ENABLE_WS_COMPRESSION === 'true' ? { threshold: 1024 } : false,
    httpCompression: true,
    maxHttpBufferSize: 1e6
  });
  return io;
}

module.exports = { createSocketIOServer };
