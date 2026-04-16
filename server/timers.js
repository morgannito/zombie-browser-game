/**
 * @fileoverview Server-level timers: game loop with sub-ms precision.
 * @description High-resolution scheduler using process.hrtime.bigint() + setImmediate.
 *   - Sub-ms precision: avoids setTimeout's ~1ms jitter floor
 *   - Drift-free: next wakeup anchored to wall-clock anchor, not elapsed time
 *   - setImmediate spin-wait only in the last <1ms window to avoid CPU waste
 */

const { performance: perf } = require('perf_hooks');
const logger = require('../infrastructure/logging/Logger');

// Nanoseconds per millisecond
const NS_PER_MS = 1_000_000n;

/**
 * Start the high-resolution game loop. Returns a cleanup function.
 * @param {{getTickInterval: () => number}} perfIntegration
 * @param {() => void} tickFn
 * @returns {() => void} stop()
 */
function startGameLoop(perfIntegration, tickFn) {
  const tickInterval = perfIntegration.getTickInterval();
  const tickIntervalNs = BigInt(Math.round(tickInterval * 1_000_000)); // ms → ns
  let running = true;
  let immediateHandle = null;
  let timeoutHandle = null;

  // Wall-clock anchor for drift-free scheduling (ns)
  let nextTickNs = process.hrtime.bigint();

  function scheduleNext() {
    if (!running) return;

    const nowNs = process.hrtime.bigint();
    const remainingNs = nextTickNs - nowNs;

    if (remainingNs <= 0n) {
      // Already late — fire immediately via setImmediate (yields event loop)
      immediateHandle = setImmediate(tick);
    } else if (remainingNs < NS_PER_MS) {
      // Less than 1ms remaining — spin with setImmediate for sub-ms precision
      immediateHandle = setImmediate(scheduleNext);
    } else {
      // More than 1ms remaining — sleep, then switch to spin 1ms before target
      const sleepMs = Number(remainingNs / NS_PER_MS) - 1;
      timeoutHandle = setTimeout(scheduleNext, Math.max(0, sleepMs));
    }
  }

  function tick() {
    if (!running) return;

    // Advance anchor by exactly one tick interval (drift-free)
    nextTickNs += tickIntervalNs;

    const now = perf.now();
    try {
      tickFn();
    } catch (err) {
      logger.error('Game loop tick error', { error: err.message, stack: err.stack });
    }
    const elapsed = perf.now() - now;
    if (elapsed > tickInterval * 1.5) {
      logger.warn('Slow tick detected', { elapsed: elapsed.toFixed(1), threshold: tickInterval });
    }

    scheduleNext();
  }

  // Kick off immediately
  immediateHandle = setImmediate(tick);

  return function stop() {
    running = false;
    if (immediateHandle !== null) {
      clearImmediate(immediateHandle);
      immediateHandle = null;
    }
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  };
}

module.exports = { startGameLoop };
