/**
 * @fileoverview Socket.IO server factory.
 * @description Encapsulates the Socket.IO configuration previously inlined in
 * server.js. Keeps protocol choices (transports, ping timing, CF-friendly
 * compression settings) in one place.
 *
 * Design notes:
 * - `transports: ['websocket']` + `allowUpgrades: false` — WS only; polling
 *   fallback was dropped to cut handshake latency (~50-200ms) and avoid the
 *   bandwidth double-cost when CF strips the upgrade.
 * - `pingInterval` / `pingTimeout` tuned for mobile/wifi volatility (20s
 *   timeout vs the default 5s that was causing spurious disconnects).
 * - `perMessageDeflate: false` — Cloudflare strips the extension headers
 *   during the upgrade handshake; leaving it on makes the edge drop the
 *   request with HTTP 400. Re-enable only on direct or CF-compatible CDNs.
 */

const { getSocketIOCorsConfig } = require('../middleware/cors');
const logger = require('../infrastructure/logging/Logger');

/** Log broadcast bytes once every N Engine.IO packets (≈ 1/100). */
const BYTES_LOG_SAMPLE = 100;

/**
 * Attach a lightweight bandwidth sampler to the Engine.IO layer.
 * Counts raw packet byte lengths server→client and logs a rolling average
 * every BYTES_LOG_SAMPLE packets. Not exact msgpack wire size but gives the
 * right order-of-magnitude trend.
 *
 * State is kept locally (closure) so multiple createSocketIOServer() calls
 * (e.g. in tests) don't share counters.
 *
 * @param {import('socket.io').Server} io
 */
function _attachBytesSampler(io) {
  if (!io || !io.engine || typeof io.engine.on !== 'function') {
    return;
  }

  // Per-instance counters — never module-level to avoid test pollution.
  let sampleCounter = 0;
  let bytesAccumulator = 0;

  io.engine.on('packet', packet => {
    if (packet.type === 'message' && packet.data) {
      const len = Buffer.isBuffer(packet.data)
        ? packet.data.length
        : Buffer.byteLength(String(packet.data), 'utf8');
      bytesAccumulator += len;
    }
    sampleCounter++;
    if (sampleCounter >= BYTES_LOG_SAMPLE) {
      logger.info('[broadcast] bytes last 100 packets', { bytes: bytesAccumulator });
      sampleCounter = 0;
      bytesAccumulator = 0;
    }
  });
}

/**
 * Build the Socket.IO server bound to an http.Server instance.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function createSocketIOServer(httpServer) {
  // Lazy-require to avoid circular init when tests mock the module.
  // Optional MessagePack binary parser (40-60% smaller packets).
  // Activate with ENABLE_MSGPACK=true. Client must load /lib/msgpack-parser.js first.
  const parserOption =
    process.env.ENABLE_MSGPACK === 'true'
      ? { parser: require('socket.io-msgpack-parser') }
      : {};

  const io = require('socket.io')(httpServer, {
    cors: getSocketIOCorsConfig(),
    // WS-only: suppresses polling fallback that adds 50-200ms to the handshake
    // and doubles bandwidth on fallback. Modern browsers + CF support WS natively.
    transports: ['websocket'],
    allowUpgrades: false,
    // pingInterval: native Socket.IO keep-alive. Independent of app-level latency
    // tracking (client-driven via handlers/ping.js). 10s is suitable for gaming;
    // do not reduce below 5s (risk of spurious mobile disconnects).
    pingInterval: 10000,
    pingTimeout: 20000,
    connectTimeout: 45000,
    // WS compression disabled by default: Cloudflare strips the extension headers
    // and causes elevated latency. Enable with ENABLE_WS_COMPRESSION=true only
    // when running behind a direct proxy (no CF).
    perMessageDeflate:
      process.env.ENABLE_WS_COMPRESSION === 'true' ? { threshold: 1024 } : false,
    httpCompression: true,
    // 10 KB is ample for any game event (move ~50B, shoot ~80B, nickname ~30B).
    // Rejects oversized frames before Socket.IO parses them — primary DoS guard.
    maxHttpBufferSize: 1e4,
    ...parserOption
  });

  // Attach broadcast bytes sampler (log 1/100 packets for bandwidth measurement).
  _attachBytesSampler(io);

  return io;
}

module.exports = { createSocketIOServer };
