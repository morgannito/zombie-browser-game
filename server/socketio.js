/**
 * @fileoverview Socket.IO server factory.
 * @description Encapsulates the Socket.IO configuration previously inlined in
 * server.js. Keeps protocol choices (transports, ping timing, CF-friendly
 * compression settings) in one place.
 */

const { getSocketIOCorsConfig } = require('../middleware/cors');
const logger = require('../infrastructure/logging/Logger');

// Broadcast bytes sampler — logs once every BYTES_LOG_SAMPLE ticks (≈ 1/100).
// Counts raw Engine.IO packet lengths emitted server→client on the WS transport.
// Not an exact msgpack wire size but gives the right order-of-magnitude trend.
const BYTES_LOG_SAMPLE = 100;
let _bytesSampleCounter = 0;
let _bytesAccumulator = 0;

function _attachBytesSampler(io) {
  if (!io || !io.engine || typeof io.engine.on !== 'function') {
    return;
  }
  io.engine.on('packet', packet => {
    if (packet.type === 'message' && packet.data) {
      const len = Buffer.isBuffer(packet.data)
        ? packet.data.length
        : Buffer.byteLength(String(packet.data), 'utf8');
      _bytesAccumulator += len;
    }
    _bytesSampleCounter++;
    if (_bytesSampleCounter >= BYTES_LOG_SAMPLE) {
      logger.info('[broadcast] bytes last 100 packets', { bytes: _bytesAccumulator });
      _bytesSampleCounter = 0;
      _bytesAccumulator = 0;
    }
  });
}

/**
 * Build the Socket.IO server bound to an http.Server instance.
 *
 * - `transports: ['websocket']` + `allowUpgrades: false` — WS only; polling
 *   fallback was dropped to cut handshake latency (~50-200ms) and avoid the
 *   bandwidth double-cost when CF strips the upgrade.
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

  // Optional: MessagePack binary parser (40-60% smaller packets).
  // Activate with ENABLE_MSGPACK=true. Client must load /lib/msgpack-parser.js first.
  const parserOption =
    process.env.ENABLE_MSGPACK === 'true' ? { parser: require('socket.io-msgpack-parser') } : {};

  const io = require('socket.io')(httpServer, {
    cors: getSocketIOCorsConfig(),
    // WS-only: supprime le fallback polling qui ajoute 50-200ms au handshake et double la bande passante en cas de fallback.
    // Les navigateurs modernes + CF supportent WS nativement.
    transports: ['websocket'],
    allowUpgrades: false,
    // pingInterval: ping natif Socket.IO (keep-alive). Indépendant du latency tracking
    // (géré par app:ping client-driven dans handlers/ping.js). 10s est raisonnable
    // pour gaming — ne pas réduire sous 5s (risque de faux disconnects sur mobile).
    pingInterval: 10000,
    pingTimeout: 20000,
    connectTimeout: 45000,
    // Désactivé par défaut (Cloudflare strippe WS compression et cause des latences élevées).
    // Activer avec ENABLE_WS_COMPRESSION=true uniquement si proxy direct (sans CF).
    perMessageDeflate: process.env.ENABLE_WS_COMPRESSION === 'true' ? { threshold: 1024 } : false,
    httpCompression: true,
    maxHttpBufferSize: 1e6,
    ...parserOption
  });

  // Attach broadcast bytes sampler (log 1/100 packets for bandwidth measurement).
  _attachBytesSampler(io);

  return io;
}

module.exports = { createSocketIOServer };
