/**
 * Unit tests for server/timers.js
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const { startGameLoop } = require('../../../server/timers');
const logger = require('../../../infrastructure/logging/Logger');

describe('startGameLoop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    logger.error.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  test('invokes tickFn immediately + returns stop()', () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 100 }, tickFn);
    expect(tickFn).toHaveBeenCalledTimes(1);
    expect(typeof stop).toBe('function');
    stop();
  });

  test('schedules next tick using drift compensation', () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    jest.advanceTimersByTime(55);
    expect(tickFn).toHaveBeenCalledTimes(2);
    stop();
  });

  test('stop() halts further ticks', () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    stop();
    jest.advanceTimersByTime(200);
    expect(tickFn).toHaveBeenCalledTimes(1); // only the initial sync call
  });

  test('swallows tickFn errors and continues', () => {
    let count = 0;
    const tickFn = jest.fn(() => {
      count++;
      if (count === 1) {
        throw new Error('boom');
      }
    });
    const stop = startGameLoop({ getTickInterval: () => 50 }, tickFn);
    expect(logger.error).toHaveBeenCalledWith(
      'Game loop tick error',
      expect.objectContaining({ error: 'boom' })
    );
    jest.advanceTimersByTime(55);
    expect(tickFn).toHaveBeenCalledTimes(2); // second call despite first throw
    stop();
  });

  test('clears pending timeout on stop', () => {
    const tickFn = jest.fn();
    const stop = startGameLoop({ getTickInterval: () => 1000 }, tickFn);
    stop();
    // No active timers remain
    expect(jest.getTimerCount()).toBe(0);
  });
});
