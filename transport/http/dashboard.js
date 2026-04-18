/**
 * @fileoverview Dashboard ASCII — GET /dashboard
 * @description Text/plain monitoring endpoint, auth Bearer (METRICS_TOKEN).
 */

const { DatabaseManager } = require('../../database/DatabaseManager');

function fmtUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTick(hist) {
  const h = hist.tick_duration_ms;
  const avg = h.count > 0 ? (h.sum / h.count).toFixed(1) : '0.0';
  const max = Math.max(...Object.entries(h.counts)
    .filter(([k]) => k !== '+Inf' && h.counts[k] > 0)
    .map(([k]) => Number(k)), 0);
  return { avg, max: max > 0 ? max.toFixed(1) : avg };
}

async function dbLatencyMs() {
  try {
    const db = DatabaseManager.getInstance();
    const t = Date.now();
    db.db.prepare('SELECT 1').get();
    return Date.now() - t;
  } catch {
 return null;
}
}

function initDashboardRoute(metricsCollector, perfIntegration) {
  const express = require('express');
  const router = express.Router();

  router.get('/', async (_req, res) => {
    const m = metricsCollector.getMetrics();
    const sys = m.system;
    const hists = metricsCollector.histograms;
    const tick = fmtTick(hists);
    const uptime = fmtUptime(sys.uptime);
    const maxP = perfIntegration?.perfConfig?.current?.maxPlayers ?? 50;
    const fps = m.performance.targetFPS || 60;
    const dbMs = await dbLatencyMs();
    const dbStr = dbMs !== null ? `${dbMs}ms latency` : 'n/a';
    const errors = metricsCollector._errorTimestamps
      ? metricsCollector._errorTimestamps.filter(t => t > Date.now() - 300000).length
      : 0;

    const W = 22;
    const pad = (s) => s.padEnd(W - 2);
    const line = (s) => `║ ${pad(s)}║`;

    const lines = [
      '╔══ ZOMBIE GAME ══════╗',
      line(`uptime: ${uptime}`),
      line(`players: ${m.players.current} / max ${maxP}`),
      line(`zombies: ${m.zombies.current}`),
      line(`bullets: ${m.bullets.current}`),
      line(`wave: ${m.game.currentWave}`),
      line(`tick: avg ${tick.avg}ms / max ${tick.max}ms / ${fps}Hz`),
      line(`memory: ${sys.memory.heapUsedMB}MB heap / ${sys.memory.rssMB}MB rss`),
      line(`db: ${dbStr}`),
      line(`errors: ${errors} last 5min`),
      '╚══════════════════════╝'
    ];

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(lines.join('\n') + '\n');
  });

  return router;
}

module.exports = initDashboardRoute;
