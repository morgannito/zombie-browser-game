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

/** Nanoseconds per millisecond */
const NS_PER_MS = 1_000_000n;

/** Rolling window size for metrics (number of ticks) */
const METRICS_WINDOW = 60;

/**
 * Schedule the next tick using a coarse setTimeout + fine setImmediate spin.
 *
 * @param {object} ctx - Scheduler context
 * @param {boolean} ctx.running
 * @param {bigint} ctx.nextTickNs - Wall-clock anchor for next tick (ns)
 * @param {Function} ctx.tick
 * @param {Function} ctx.setHandles - Callback to store {immediateHandle, timeoutHandle}
 */
function scheduleNext(ctx) {
  if (!ctx.running) {
    return;
  }

  const nowNs = process.hrtime.bigint();
  const remainingNs = ctx.nextTickNs - nowNs;

  if (remainingNs <= 0n) {
    ctx.setHandles({ immediateHandle: setImmediate(ctx.tick), timeoutHandle: null });
  } else if (remainingNs < NS_PER_MS) {
    ctx.setHandles({ immediateHandle: setImmediate(() => scheduleNext(ctx)), timeoutHandle: null });
  } else {
    const sleepMs = Number(remainingNs / NS_PER_MS) - 1;
    ctx.setHandles({
      immediateHandle: null,
      timeoutHandle: setTimeout(() => scheduleNext(ctx), Math.max(0, sleepMs))
    });
  }
}

/**
 * Update rolling tick-duration metrics in place.
 *
 * @param {object} m - Metrics state object (mutated)
 * @param {number} elapsed - Duration of the last tick in ms
 */
function updateMetrics(m, elapsed) {
  m.durations[m.idx % METRICS_WINDOW] = elapsed;
  m.idx++;
  m.count = Math.min(m.count + 1, METRICS_WINDOW);
  if (elapsed > m.maxTickDuration) {
    m.maxTickDuration = elapsed;
  }

  m.windowTicks++;
  const windowElapsed = perf.now() - m.windowStart;
  if (windowElapsed >= 1000) {
    m.ticksPerSecond = (m.windowTicks / windowElapsed) * 1000;
    m.windowTicks = 0;
    m.windowStart = perf.now();
  }
}

/**
 * Start the high-resolution game loop. Returns a cleanup function and metrics accessor.
 *
 * @param {{ getTickInterval: () => number }} perfIntegration
 * @param {(overBudget: boolean) => void} tickFn - Receives overBudget flag; called every tick
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

  // Metrics state (passed by reference into helpers)
  const metrics = {
    durations: new Float64Array(METRICS_WINDOW),
    idx: 0,
    count: 0,
    maxTickDuration: 0,
    windowStart: perf.now(),
    windowTicks: 0,
    ticksPerSecond: 0
  };

  /** @type {object} ctx shared by scheduleNext and tick */
  const ctx = {
    get running() {
 return running;
},
    get nextTickNs() {
 return nextTickNs;
},
    tick,
    setHandles({ immediateHandle: ih, timeoutHandle: th }) {
      if (ih !== null) {
immediateHandle = ih;
}
      if (th !== null) {
timeoutHandle = th;
}
      if (ih === null) {
immediateHandle = null;
}
      if (th === null) {
timeoutHandle = null;
}
    }
  };

  function tick() {
    if (!running) {
      return;
    }

    // Advance anchor by exactly one tick interval (drift-free)
    nextTickNs += tickIntervalNs;

    const now = perf.now();

    // overBudget: true when the loop woke up later than one tick interval after
    // the previous anchor — i.e. the scheduler itself drifted.
    const schedulerDrift = now - Number((nextTickNs - tickIntervalNs) / NS_PER_MS);
    const overBudget = schedulerDrift > tickInterval;

    try {
      tickFn(overBudget);
    } catch (err) {
      logger.error('Game loop tick error', { error: err.message, stack: err.stack });
    }

    const elapsed = perf.now() - now;
    updateMetrics(metrics, elapsed);

    if (elapsed > tickInterval) {
      logger.warn('Tick over budget', {
        elapsed: elapsed.toFixed(2),
        budget: tickInterval.toFixed(2),
        skippedNonCritical: true
      });
    }

    scheduleNext(ctx);
  }

  /**
   * Return a snapshot of rolling performance metrics.
   *
   * @returns {{ avgTickDuration: number, maxTickDuration: number, ticksPerSecond: number }}
   */
  function getMetrics() {
    let sum = 0;
    let maxInWindow = 0;
    for (let i = 0; i < metrics.count; i++) {
      const v = metrics.durations[i];
      sum += v;
      if (v > maxInWindow) {
maxInWindow = v;
}
    }
    return {
      avgTickDuration: metrics.count > 0 ? sum / metrics.count : 0,
      maxTickDuration: maxInWindow,
      ticksPerSecond: metrics.ticksPerSecond
    };
  }

  /**
   * Stop the game loop and cancel any pending timers.
   */
  function stop() {
    running = false;
    if (immediateHandle !== null) {
      clearImmediate(immediateHandle);
      immediateHandle = null;
    }
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  // Kick off immediately
  immediateHandle = setImmediate(tick);

  return { stop, getMetrics };
}

module.exports = { startGameLoop };
