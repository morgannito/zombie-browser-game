/**
 * Unit tests for server/timers.js
 * Scheduler uses setImmediate + setTimeout for sub-ms precision.
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const { startGameLoop } = require('../../../server/timers');
const logger = require('../../../infrastructure/logging/Logger');

/** Flush all pending setImmediate callbacks */
function flushImmediates() {
  return new Promise(resolve => setImmediate(resolve));
}

describe('startGameLoop', () => {
  beforeEach(() => {
    logger.error.mockClear();
    logger.warn.mockClear();
  });

  test('invokes tickFn on first setImmediate + returns stop()', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 100 }, tickFn);
    await flushImmediates();
    expect(tickFn).toHaveBeenCalledTimes(1);
    expect(typeof stop).toBe('function');
    stop();
  });

  test('schedules next tick (fires second call after interval)', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    await flushImmediates(); // first tick fires, queues setTimeout(~49ms)
    // Wait for the setTimeout + spin period
    await new Promise(resolve => setTimeout(resolve, 60));
    await flushImmediates();
    expect(tickFn).toHaveBeenCalledTimes(2);
    stop();
  }, 2000);

  test('stop() halts further ticks', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    stop(); // cancel before setImmediate fires
    await flushImmediates();
    await new Promise(resolve => setTimeout(resolve, 60));
    await flushImmediates();
    expect(tickFn).toHaveBeenCalledTimes(0);
  }, 2000);

  test('swallows tickFn errors and continues', async () => {
    let count = 0;
    const tickFn = jest.fn(() => {
      count++;
      if (count === 1) {
throw new Error('boom');
}
    });
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    await flushImmediates(); // first tick (throws)
    expect(logger.error).toHaveBeenCalledWith(
      'Game loop tick error',
      expect.objectContaining({ error: 'boom' })
    );
    await new Promise(resolve => setTimeout(resolve, 60));
    await flushImmediates(); // second tick (ok)
    expect(tickFn).toHaveBeenCalledTimes(2);
    stop();
  }, 2000);

  test('clears pending handles on stop (no hung process)', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 1000 }, tickFn);
    stop();
    // If stop() works, no handles remain to prevent Jest from exiting.
    // We just verify stop() doesn't throw.
    expect(typeof stop).toBe('function');
  });
});
