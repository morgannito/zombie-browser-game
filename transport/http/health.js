/**
 * @fileoverview Health check route
 * @description GET /health — structured JSON, HTTP 200/503, 1s cache
 */

const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
// Connexion readonly dédiée pour le health check — évite de bloquer le thread principal
let _healthDb = null;
function getHealthDb(dbManager) {
  if (_healthDb) {
return _healthDb;
}
  try {
    const dbPath = dbManager.db && dbManager.db.name;
    if (!dbPath) {
return null;
}
    _healthDb = new Database(dbPath, { readonly: true });
    _healthDb.pragma('busy_timeout = 500'); // timeout court : fail-fast pour le health
    return _healthDb;
  } catch (_) {
    return null;
  }
}

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 5000; // 5s — réduit la contention sous charge

function toMB(bytes) {
  return parseFloat((bytes / 1024 / 1024).toFixed(2));
}

function measureDbLatency(dbManager) {
  if (!dbManager.isInitialized) {
return { connected: false, latency_ms: null };
}
  const probe = getHealthDb(dbManager);
  if (!probe) {
return { connected: false, latency_ms: null, error: 'health-db-unavailable' };
}
  try {
    const t0 = process.hrtime.bigint();
    probe.prepare('SELECT 1').get();
    const latency_ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return { connected: true, latency_ms: parseFloat(latency_ms.toFixed(2)) };
  } catch (err) {
    // SQLITE_BUSY = DB surchargée mais connectée (soft degradation)
    const isBusy = err && (err.code === 'SQLITE_BUSY' || err.code === 'SQLITE_LOCKED');
    if (isBusy) {
      return { connected: true, latency_ms: '>500', degraded: true };
    }
    _healthDb = null; // reset pour réessayer à la prochaine requête
    return { connected: false, latency_ms: null, error: err.message };
  }
}

function buildPayload(dbManager, metricsCollector, gameLoopRef) {
  const m = metricsCollector.getMetrics();
  const mem = process.memoryUsage();
  const db = measureDbLatency(dbManager);
  const rawTick = gameLoopRef ? gameLoopRef.getMetrics() : null;
  const tick = rawTick && rawTick.avgTickDuration !== undefined ? rawTick : null;
  const errorsLast5min = metricsCollector._errorTimestamps
    ? metricsCollector._errorTimestamps.filter(t => t > Date.now() - 300000).length
    : 0;
  const errorsTotal = metricsCollector._errorTimestamps
    ? metricsCollector._errorTimestamps.length
    : 0;

  const status = !db.connected ? 'unhealthy'
    : (db.degraded || (typeof db.latency_ms === 'number' && db.latency_ms > 200)) ? 'degraded'
    : 'healthy';

  return {
    status,
    uptime: m.system.uptime,
    memory: {
      rss: toMB(mem.rss),
      heapUsed: toMB(mem.heapUsed),
      heapTotal: toMB(mem.heapTotal),
      external: toMB(mem.external)
    },
    game: {
      players: m.players.current,
      zombies: m.zombies.current,
      bullets: m.bullets.current,
      wave: m.game.currentWave
    },
    db,
    tick: tick ? {
      avgDurationMs: parseFloat(tick.avgTickDuration.toFixed(2)),
      maxDurationMs: parseFloat(tick.maxTickDuration.toFixed(2)),
      ticksPerSecond: parseFloat(tick.ticksPerSecond.toFixed(2))
    } : null,
    errors: {
      last5min: errorsLast5min,
      total: errorsTotal
    }
  };
}

/**
 * @param {Object} dbManager
 * @param {Object} metricsCollector
 * @param {Object} [gameLoop] - optional { getMetrics }
 * @returns {express.Router}
 */
function initHealthRoute(dbManager, metricsCollector, gameLoopRef) {
  router.get('/', (_req, res) => {
    const now = Date.now();
    if (_cache && now - _cacheAt < CACHE_TTL_MS) {
      const code = _cache.status === 'healthy' ? 200 : 503;
      return res.status(code).json(_cache);
    }
    _cache = buildPayload(dbManager, metricsCollector, gameLoopRef);
    _cacheAt = now;
    const code = _cache.status === 'healthy' ? 200 : 503;
    res.status(code).json(_cache);
  });

  return router;
}

module.exports = initHealthRoute;
