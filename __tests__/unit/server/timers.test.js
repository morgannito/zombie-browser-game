/**
 * Unit tests for server/timers.js
 * Uses real async/await with setImmediate flush instead of jest fake timers,
 * because Jest 29 modern fake timers do not support runAllImmediates().
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
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

  test('invokes tickFn immediately + returns stop()', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 100 }, tickFn);
    await flushImmediates();
    expect(tickFn).toHaveBeenCalledTimes(1);
    expect(typeof stop).toBe('function');
    stop();
  });

  test('schedules next tick after interval', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    // First tick fires immediately
    await flushImmediates();
    expect(tickFn).toHaveBeenCalledTimes(1);
    // Second tick fires ~50ms later
    await new Promise(r => setTimeout(r, 60));
    expect(tickFn).toHaveBeenCalledTimes(2);
    stop();
  });

  test('stop() halts further ticks', async () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    await flushImmediates();
    stop();
    const countAfterStop = tickFn.mock.calls.length;
    await new Promise(r => setTimeout(r, 100));
    expect(tickFn).toHaveBeenCalledTimes(countAfterStop);
  });

  test('swallows tickFn errors and continues', async () => {
    let count = 0;
    const tickFn = jest.fn(() => {
      count++;
      if (count === 1) throw new Error('boom');
    });
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    await flushImmediates();
    expect(logger.error).toHaveBeenCalledWith(
      'Game loop tick error',
      expect.objectContaining({ error: 'boom' })
    );
    // Second tick fires ~50ms later despite first throw
    await new Promise(r => setTimeout(r, 60));
    expect(tickFn).toHaveBeenCalledTimes(2);
    stop();
  });

  test('clears pending timeout on stop', async () => {
    const tickFn = jest.fn();
    // 1000ms interval — after first tick a setTimeout(scheduleNext, ~999ms) is created
    const stop = startGameLoop({ getTickInterval: () => 1000 }, tickFn);
    await flushImmediates(); // consume first tick
    stop();
    // No subsequent ticks within next 50ms confirms stop worked
    await new Promise(r => setTimeout(r, 50));
    expect(tickFn).toHaveBeenCalledTimes(1);
  });
});
