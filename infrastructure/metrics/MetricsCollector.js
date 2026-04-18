/**
 * METRICS COLLECTOR
 * Orchestre HistogramCollector, CounterCollector et PrometheusFormatter
 * @version 2.0.0
 */

const os = require('os');
const logger = require('../logging/Logger');
const HistogramCollector = require('./HistogramCollector');
const CounterCollector = require('./CounterCollector');
const PrometheusFormatter = require('./PrometheusFormatter');

class MetricsCollector {
  constructor() {
    this.startTime = Date.now();

    this._histo = new HistogramCollector();
    this._counters = new CounterCollector();
    this._formatter = new PrometheusFormatter();

    // Compteurs de base
    this.metrics = {
      players: { current: 0, total: 0, peak: 0 },
      zombies: { current: 0, spawned: 0, killed: 0 },
      powerups: { current: 0, spawned: 0, collected: 0 },
      bullets: { current: 0, fired: 0 },
      performance: { tickRate: 0, actualFPS: 0, targetFPS: 0, avgFrameTime: 0, maxFrameTime: 0 },
      network: { bytesIn: 0, bytesOut: 0, messagesIn: 0, messagesOut: 0 },
      game: { currentWave: 0, highestWave: 0, activeGames: 0, total_shots: 0, total_hits: 0 },
      anticheat: {
        cheat_attempts_total: {},
        rate_limit_blocks_total: {},
        movement_corrections_total: 0,
        player_disconnects_total: 0
      }
    };

    // Historique frames
    this.frameTimes = [];
    this.maxFrameTimeSamples = 60;
    this.lastFpsSample = Date.now();
    this.frameCount = 0;

    // Error rate tracking
    this._errorTimestamps = [];
    this._errorCountsByContext = {};
    this._ERROR_WINDOW_MS = 60000;

    // Délégation violation tracker
    this.violationTracker = this._counters.violationTracker;
    this.VIOLATION_THRESHOLD = this._counters.VIOLATION_THRESHOLD;
    this.VIOLATION_WINDOW_MS = this._counters.VIOLATION_WINDOW_MS;
  }

  // ── Exposition du sous-objet histograms (compat. reset/tests) ──
  get histograms() {
 return this._histo.histograms;
}

  // ── Histogrammes ──
  recordFpsSample(fps)        {
 this._histo.recordFpsSample(fps);
}
  recordLatency(ms)           {
 this._histo.recordLatency(ms);
}
  recordBroadcastDuration(ms) {
 this._histo.recordBroadcastDuration(ms);
}
  recordTickDuration(ms)      {
 this._histo.recordTickDuration(ms);
}
  recordBroadcastBytes(bytes) {
 this._histo.recordBroadcastBytes(bytes);
}
  recordGcPause(ms)           {
 this._histo.recordGcPause(ms);
}

  // ── Counters jeu ──
  incrementShots(count = 1)   {
 this.metrics.game.total_shots += count;
}
  incrementHits(count = 1)    {
 this.metrics.game.total_hits += count;
}

  // ── Erreurs ──
  incrementError(context = 'unknown') {
    const now = Date.now();
    this._errorTimestamps.push(now);
    const cutoff = now - this._ERROR_WINDOW_MS;
    let i = 0;
    while (i < this._errorTimestamps.length && this._errorTimestamps[i] < cutoff) {
i++;
}
    if (i > 0) {
this._errorTimestamps.splice(0, i);
}
    this._errorCountsByContext[context] = (this._errorCountsByContext[context] || 0) + 1;
  }

  getErrorsPerMinute() {
    const cutoff = Date.now() - this._ERROR_WINDOW_MS;
    let count = 0;
    for (let i = this._errorTimestamps.length - 1; i >= 0; i--) {
      if (this._errorTimestamps[i] < cutoff) {
break;
}
      count++;
    }
    return count;
  }

  // ── Players ──
  updatePlayers(gameState) {
    const players = gameState.players || {};
    let cur = 0;
    for (const _ in players) {
cur++;
}
    this.metrics.players.current = cur;
    this.metrics.players.peak = Math.max(this.metrics.players.peak, cur);
  }

  incrementTotalPlayers() {
 this.metrics.players.total++;
}

  // ── Zombies ──
  updateZombies(gameState) {
    const zombies = gameState.zombies || {};
    let count = 0;
    for (const _ in zombies) {
count++;
}
    this.metrics.zombies.current = count;
  }

  incrementZombiesSpawned(count = 1) {
 this.metrics.zombies.spawned += count;
}
  incrementZombiesKilled()           {
 this.metrics.zombies.killed++;
}

  // ── Power-ups ──
  updatePowerups(gameState) {
    const powerups = gameState.powerups || {};
    let count = 0;
    for (const _ in powerups) {
count++;
}
    this.metrics.powerups.current = count;
  }

  incrementPowerupsSpawned()   {
 this.metrics.powerups.spawned++;
}
  incrementPowerupsCollected() {
 this.metrics.powerups.collected++;
}

  // ── Bullets ──
  updateBullets(gameState) {
    const bullets = gameState.bullets || {};
    let count = 0;
    for (const _ in bullets) {
count++;
}
    this.metrics.bullets.current = count;
  }

  incrementBulletsFired(count = 1) {
 this.metrics.bullets.fired += count;
}

  // ── Performance ──
  recordFrameTime(frameTime) {
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimeSamples) {
this.frameTimes.shift();
}

    this.frameCount++;
    const now = Date.now();
    const elapsed = now - this.lastFpsSample;
    if (elapsed >= 1000) {
      this.metrics.performance.actualFPS = Math.round((this.frameCount * 1000) / elapsed);
      this.recordFpsSample(this.metrics.performance.actualFPS);
      this.frameCount = 0;
      this.lastFpsSample = now;
    }

    let sum = 0; let max = 0;
    for (let i = 0; i < this.frameTimes.length; i++) {
      sum += this.frameTimes[i];
      if (this.frameTimes[i] > max) {
max = this.frameTimes[i];
}
    }
    this.metrics.performance.avgFrameTime = sum / this.frameTimes.length;
    this.metrics.performance.maxFrameTime = max;
  }

  setTargetFPS(fps) {
 this.metrics.performance.targetFPS = fps;
}

  // ── Réseau ──
  recordNetworkIn(bytes) {
    this.metrics.network.bytesIn += bytes;
    this.metrics.network.messagesIn++;
  }

  recordNetworkOut(bytes) {
    this.metrics.network.bytesOut += bytes;
    this.metrics.network.messagesOut++;
  }

  // ── Jeu ──
  updateGame(gameState) {
    this.metrics.game.currentWave = gameState.wave || 0;
    this.metrics.game.highestWave = Math.max(this.metrics.game.highestWave, this.metrics.game.currentWave);
    let activePlayers = 0;
    const players = gameState.players || {};
    for (const id in players) {
      if (players[id].hasNickname) {
activePlayers++;
}
    }
    this.metrics.game.activeGames = activePlayers;
  }

  // ── Système ──
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      processUptime: Math.floor(process.uptime()),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (memUsage.rss / 1024 / 1024).toFixed(2)
      },
      cpu: { user: cpuUsage.user, system: cpuUsage.system },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        totalMemoryMB: (os.totalmem() / 1024 / 1024).toFixed(2),
        freeMemoryMB: (os.freemem() / 1024 / 1024).toFixed(2),
        memoryUsagePercent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2),
        loadAverage: os.loadavg(),
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch()
      }
    };
  }

  getMetrics() {
    return { ...this.metrics, system: this.getSystemMetrics() };
  }

  // ── Anti-cheat (délégués aux compteurs + sync vers metrics) ──
  recordCheatAttempt(type) {
    this._counters.recordCheatAttempt(type);
    this.metrics.anticheat.cheat_attempts_total = this._counters.anticheat.cheat_attempts_total;
  }

  recordRateLimitBlock(event) {
    this._counters.recordRateLimitBlock(event);
    this.metrics.anticheat.rate_limit_blocks_total = this._counters.anticheat.rate_limit_blocks_total;
  }

  recordMovementCorrection() {
    this._counters.recordMovementCorrection();
    this.metrics.anticheat.movement_corrections_total = this._counters.anticheat.movement_corrections_total;
  }

  recordViolation(socketId)  {
 return this._counters.recordViolation(socketId);
}
  clearViolations(socketId)  {
 this._counters.clearViolations(socketId);
}

  // ── Cleanup ──
  recordCleanup(stats) {
    if (!this.metrics.cleanup) {
      this.metrics.cleanup = { runs_total: 0, players_removed_total: 0, orphaned_total: 0 };
    }
    this.metrics.cleanup.runs_total++;
    this.metrics.cleanup.players_removed_total += (stats && stats.playersRemoved) || 0;
    this.metrics.cleanup.orphaned_total += (stats && stats.orphaned) || 0;
  }

  // ── Prometheus ──
  getPrometheusMetrics() {
    return this._formatter.format(this.getMetrics(), this._histo.histograms);
  }

  // ── Logs ──
  logMetrics() {
    const metrics = this.getMetrics();
    logger.info('Server metrics', {
      players: metrics.players.current,
      zombies: metrics.zombies.current,
      fps: `${metrics.performance.actualFPS}/${metrics.performance.targetFPS}`,
      memoryMB: metrics.system.memory.rssMB,
      wave: metrics.game.currentWave
    });
  }

  // ── Reset ──
  reset() {
    this.metrics.players.total = 0;
    this.metrics.zombies.spawned = 0;
    this.metrics.zombies.killed = 0;
    this.metrics.powerups.spawned = 0;
    this.metrics.powerups.collected = 0;
    this.metrics.bullets.fired = 0;
    this.metrics.game.total_shots = 0;
    this.metrics.game.total_hits = 0;
    this.metrics.network.bytesIn = 0;
    this.metrics.network.bytesOut = 0;
    this.metrics.network.messagesIn = 0;
    this.metrics.network.messagesOut = 0;
    this.metrics.anticheat.cheat_attempts_total = {};
    this.metrics.anticheat.rate_limit_blocks_total = {};
    this.metrics.anticheat.movement_corrections_total = 0;
    this.metrics.anticheat.player_disconnects_total = 0;
    this._counters.reset();
    this._histo.reset();
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
instance = new MetricsCollector();
}
    return instance;
  }
};
