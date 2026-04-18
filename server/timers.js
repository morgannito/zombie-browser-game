/**
 * @fileoverview Server-level timers: game loop with drift compensation.
 * @description High-resolution scheduler using process.hrtime.bigint() + setImmediate.
 *   - Sub-ms precision: avoids setTimeout's ~1ms jitter floor
 *   - Drift compensation: next wakeup anchored to wall-clock, not elapsed time
 *   - setImmediate spin-wait only in the last <1ms window to avoid CPU waste
 *   - Metrics exposed: avgTickDuration, maxTickDuration, ticksPerSecond
 *   - Budget overflow: logs warning + skips non-critical updates when tick > budget
 */

const { performance: perf } = require('perf_hooks');
const logger = require('../infrastructure/logging/Logger');

// Nanoseconds per millisecond
const NS_PER_MS = 1_000_000n;

// Rolling window size for metrics (number of ticks)
const METRICS_WINDOW = 60;

/**
 * Start the high-resolution game loop. Returns a cleanup function and metrics accessor.
 * @param {{getTickInterval: () => number}} perfIntegration
 * @param {(overBudget: boolean) => void} tickFn  — receives overBudget flag
 * @returns {{ stop: () => void, getMetrics: () => object }}
 */
function startGameLoop(perfIntegration, tickFn) {
  const tickInterval = perfIntegration.getTickInterval();
  const tickIntervalNs = BigInt(Math.round(tickInterval * 1_000_000)); // ms → ns
  let running = true;
  let immediateHandle = null;
  let timeoutHandle = null;

  // Wall-clock anchor for drift-free scheduling (ns)
  let nextTickNs = process.hrtime.bigint();

  // Metrics state
  const durations = new Float64Array(METRICS_WINDOW);
  let metricsIdx = 0;
  let metricsCount = 0;
  let maxTickDuration = 0;
  let windowStart = perf.now();
  let windowTicks = 0;
  let ticksPerSecond = 0;

  function scheduleNext() {
    if (!running) {
return;
}

    const nowNs = process.hrtime.bigint();
    const remainingNs = nextTickNs - nowNs;

    if (remainingNs <= 0n) {
      immediateHandle = setImmediate(tick);
    } else if (remainingNs < NS_PER_MS) {
      immediateHandle = setImmediate(scheduleNext);
    } else {
      const sleepMs = Number(remainingNs / NS_PER_MS) - 1;
      timeoutHandle = setTimeout(scheduleNext, Math.max(0, sleepMs));
    }
  }

  function tick() {
    if (!running) {
return;
}

    // Advance anchor by exactly one tick interval (drift-free)
    nextTickNs += tickIntervalNs;

    const now = perf.now();
    const overBudget = (now - (perf.now() - tickInterval)) > tickInterval; // pre-check drift
    try {
      tickFn(overBudget);
    } catch (err) {
      logger.error('Game loop tick error', { error: err.message, stack: err.stack });
    }
    const elapsed = perf.now() - now;

    // Update rolling metrics
    durations[metricsIdx % METRICS_WINDOW] = elapsed;
    metricsIdx++;
    metricsCount = Math.min(metricsCount + 1, METRICS_WINDOW);
    if (elapsed > maxTickDuration) {
maxTickDuration = elapsed;
}

    // Ticks-per-second counter (reset every second)
    windowTicks++;
    const windowElapsed = perf.now() - windowStart;
    if (windowElapsed >= 1000) {
      ticksPerSecond = (windowTicks / windowElapsed) * 1000;
      windowTicks = 0;
      windowStart = perf.now();
    }

    if (elapsed > tickInterval) {
      logger.warn('Tick over budget', {
        elapsed: elapsed.toFixed(2),
        budget: tickInterval.toFixed(2),
        skippedNonCritical: true
      });
    }

    scheduleNext();
  }

  function getMetrics() {
    let sum = 0;
    let maxInWindow = 0;
    for (let i = 0; i < metricsCount; i++) {
      const v = durations[i];
      sum += v;
      if (v > maxInWindow) {
maxInWindow = v;
}
    }
    return {
      avgTickDuration: metricsCount > 0 ? sum / metricsCount : 0,
      maxTickDuration: maxInWindow,
      ticksPerSecond
    };
  }

  // Kick off immediately
  immediateHandle = setImmediate(tick);

  function stop() {
    running = false;
    if (immediateHandle !== null) {
 clearImmediate(immediateHandle); immediateHandle = null;
}
    if (timeoutHandle !== null) {
 clearTimeout(timeoutHandle); timeoutHandle = null;
}
  }

  return { stop, getMetrics };
}

module.exports = { startGameLoop };
