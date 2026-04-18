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

/**
 * Derive overall health status from DB probe result.
 * @param {Object} db - Result of measureDbLatency
 * @returns {'healthy'|'degraded'|'unhealthy'}
 */
function deriveStatus(db) {
  if (!db.connected) return 'unhealthy';
  if (db.degraded || (typeof db.latency_ms === 'number' && db.latency_ms > 200)) return 'degraded';
  return 'healthy';
}

/**
 * Build tick snapshot from game loop metrics.
 * @param {Object|null} gameLoopRef
 * @returns {Object|null}
 */
function buildTickSnapshot(gameLoopRef) {
  const raw = gameLoopRef ? gameLoopRef.getMetrics() : null;
  if (!raw || raw.avgTickDuration === undefined) return null;
  return {
    avgDurationMs: parseFloat(raw.avgTickDuration.toFixed(2)),
    maxDurationMs: parseFloat(raw.maxTickDuration.toFixed(2)),
    ticksPerSecond: parseFloat(raw.ticksPerSecond.toFixed(2))
  };
}

/**
 * Build error counts from metricsCollector timestamps.
 * @param {Object} metricsCollector
 * @returns {{ last5min: number, total: number }}
 */
function buildErrorCounts(metricsCollector) {
  const ts = metricsCollector._errorTimestamps;
  if (!ts) return { last5min: 0, total: 0 };
  return {
    last5min: ts.filter(t => t > Date.now() - 300000).length,
    total: ts.length
  };
}

/**
 * Build complete health payload.
 * @param {Object} dbManager
 * @param {Object} metricsCollector
 * @param {Object|null} gameLoopRef
 * @returns {Object}
 */
function buildPayload(dbManager, metricsCollector, gameLoopRef) {
  const m = metricsCollector.getMetrics();
  const mem = process.memoryUsage();
  const db = measureDbLatency(dbManager);
  return {
    status: deriveStatus(db),
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
    tick: buildTickSnapshot(gameLoopRef),
    errors: buildErrorCounts(metricsCollector)
  };
}

/**
 * @param {Object} dbManager
 * @param {Object} metricsCollector
 * @param {Object} [gameLoop] - optional { getMetrics }
 * @returns {express.Router}
 */
function initHealthRoute(dbManager, metricsCollector, gameLoopRef) {
  // Liveness: le process est vivant (pas de dépendances externes)
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

  // Readiness: le service est prêt à recevoir du trafic (DB + tick + mémoire)
  router.get('/ready', (_req, res) => {
    const db = measureDbLatency(dbManager);
    const mem = process.memoryUsage();
    const tick = gameLoopRef ? gameLoopRef.getMetrics() : null;

    const checks = {
      db: db.connected && (typeof db.latency_ms !== 'number' || db.latency_ms <= 100),
      memory: mem.heapUsed < 500 * 1024 * 1024,
      tick: !tick || (tick.maxTickDuration === undefined || tick.maxTickDuration <= 50)
    };

    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({
      ready,
      checks: {
        db: { ok: checks.db, latency_ms: db.latency_ms },
        memory: { ok: checks.memory, heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)) },
        tick: { ok: checks.tick, maxDurationMs: tick ? parseFloat((tick.maxTickDuration || 0).toFixed(2)) : null }
      }
    });
  });

  return router;
}

module.exports = initHealthRoute;
