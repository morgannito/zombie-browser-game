/**
 * @fileoverview Server-level timers: game loop with drift compensation.
 * @description Extracted from server.js. setTimeout-recursive pattern prevents
 *   tick overlap (vs setInterval) and compensates for tick execution time so
 *   the effective frame rate stays close to the configured target.
 */

const { performance: perf } = require('perf_hooks');
const logger = require('../infrastructure/logging/Logger');

/**
 * Start the recursive game loop. Returns a cleanup function.
 * @param {{getTickInterval: () => number}} perfIntegration
 * @param {() => void} tickFn
 * @returns {() => void} stop()
 */
function startGameLoop(perfIntegration, tickFn) {
  const tickInterval = perfIntegration.getTickInterval();
  let tickTimeout = null;
  let running = true;

  function tick() {
    if (!running) {
return;
}
    const now = perf.now();
    try {
      tickFn();
    } catch (err) {
      logger.error('Game loop tick error', { error: err.message, stack: err.stack });
    }
    const elapsed = perf.now() - now;
    const nextTick = Math.max(0, tickInterval - elapsed);
    tickTimeout = setTimeout(tick, nextTick);
  }

  tick();

  return function stop() {
    running = false;
    if (tickTimeout !== null) {
      clearTimeout(tickTimeout);
      tickTimeout = null;
    }
  };
}

module.exports = { startGameLoop };
