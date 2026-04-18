/**
 * PROMETHEUS FORMATTER
 * Sérialise les métriques au format Prometheus text exposition
 */

class PrometheusFormatter {
  /**
   * @param {import('./HistogramCollector')} histograms
   */
  format(metrics, histograms) {
    const lines = [];

    // Counters jeu
    this._counter(lines, 'zombie_total_kills',       'Total zombies killed',            metrics.zombies.killed);
    this._counter(lines, 'zombie_total_shots',       'Total shots fired',               metrics.game.total_shots);
    this._counter(lines, 'zombie_total_hits',        'Total shots that hit a zombie',   metrics.game.total_hits);
    this._counter(lines, 'zombie_total_connections', 'Total player connections',        metrics.players.total);

    // Gauges jeu
    this._gauge(lines, 'zombie_active_players', 'Currently connected players',    metrics.players.current);
    this._gauge(lines, 'zombie_active_zombies', 'Active zombies on the map',       metrics.zombies.current);
    this._gauge(lines, 'zombie_active_bullets', 'Active bullets in flight',        metrics.bullets.current);

    // Players
    this._gauge(lines,   'zombie_players_current', 'Current number of connected players',   metrics.players.current);
    this._counter(lines, 'zombie_players_total',   'Total number of players that connected', metrics.players.total);
    this._gauge(lines,   'zombie_players_peak',    'Peak number of concurrent players',      metrics.players.peak);

    // Zombies
    this._gauge(lines,   'zombie_zombies_current', 'Current number of active zombies', metrics.zombies.current);
    this._counter(lines, 'zombie_zombies_spawned', 'Total zombies spawned',            metrics.zombies.spawned);
    this._counter(lines, 'zombie_zombies_killed',  'Total zombies killed',             metrics.zombies.killed);

    // Performance
    this._gauge(lines, 'zombie_fps_actual',      'Actual server FPS',         metrics.performance.actualFPS);
    this._gauge(lines, 'zombie_fps_target',      'Target server FPS',         metrics.performance.targetFPS);
    this._gauge(lines, 'zombie_frame_time_avg',  'Average frame time in ms',  metrics.performance.avgFrameTime.toFixed(2));
    this._gauge(lines, 'zombie_frame_time_max',  'Maximum frame time in ms',  metrics.performance.maxFrameTime.toFixed(2));

    // Memory
    this._gauge(lines, 'zombie_memory_heap_used', 'Heap memory used in bytes', metrics.system.memory.heapUsed);
    this._gauge(lines, 'zombie_memory_rss',        'Resident Set Size in bytes', metrics.system.memory.rss);

    // Game
    this._gauge(lines, 'zombie_wave_current', 'Current wave number', metrics.game.currentWave);
    this._gauge(lines, 'zombie_wave_highest', 'Highest wave reached', metrics.game.highestWave);

    // Anti-cheat
    lines.push('# HELP zombie_cheat_attempts_total Total cheat attempts by type');
    lines.push('# TYPE zombie_cheat_attempts_total counter');
    Object.entries(metrics.anticheat.cheat_attempts_total).forEach(([type, val]) => {
      lines.push(`zombie_cheat_attempts_total{type="${type}"} ${val}`);
    });

    lines.push('# HELP zombie_rate_limit_blocks_total Total rate limit blocks by event');
    lines.push('# TYPE zombie_rate_limit_blocks_total counter');
    Object.entries(metrics.anticheat.rate_limit_blocks_total).forEach(([event, val]) => {
      lines.push(`zombie_rate_limit_blocks_total{event="${event}"} ${val}`);
    });

    this._counter(lines, 'zombie_movement_corrections_total', 'Total server-side position corrections',          metrics.anticheat.movement_corrections_total);
    this._counter(lines, 'zombie_player_disconnects_total',   'Total auto-disconnects for cheat violations',     metrics.anticheat.player_disconnects_total);

    // Uptime
    this._counter(lines, 'zombie_uptime_seconds', 'Server uptime in seconds', metrics.system.uptime);

    // Histogrammes
    lines.push(this._histogram('zombie_fps',                  'Server FPS distribution',                            histograms.fps));
    lines.push(this._histogram('zombie_request_latency_ms',   'HTTP request latency in ms',                         histograms.latency));
    lines.push(this._histogram('zombie_tick_duration_ms',     'Game loop tick duration (ms)',                        histograms.tick_duration_ms));
    lines.push(this._histogram('zombie_broadcast_duration_ms','emitGameState wall-clock duration (ms)',              histograms.broadcast_ms));
    lines.push(this._histogram('zombie_broadcast_ms',         'emitGameState wall-clock duration (ms) — legacy alias', histograms.broadcast_ms));
    lines.push(this._histogram('zombie_broadcast_bytes',      'Total bytes emitted per tick across all sockets',    histograms.broadcast_bytes));
    lines.push(this._histogram('zombie_gc_pause_ms',          'V8 GC pause duration (ms) captured via PerformanceObserver', histograms.gc_pause_ms));

    return lines.join('\n') + '\n';
  }

  _counter(lines, name, help, value) {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name} ${value}`);
  }

  _gauge(lines, name, help, value) {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  }

  _histogram(metricName, help, hist) {
    const lines = [];
    lines.push(`# HELP ${metricName} ${help}`);
    lines.push(`# TYPE ${metricName} histogram`);
    for (const b of hist.buckets) {
      lines.push(`${metricName}_bucket{le="${b}"} ${hist.counts[b]}`);
    }
    lines.push(`${metricName}_bucket{le="+Inf"} ${hist.counts['+Inf']}`);
    lines.push(`${metricName}_sum ${hist.sum}`);
    lines.push(`${metricName}_count ${hist.count}`);
    return lines.join('\n');
  }
}

module.exports = PrometheusFormatter;
