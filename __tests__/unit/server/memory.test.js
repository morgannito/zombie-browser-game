/**
 * Unit tests for server/memory.js
 */

const mockStart = jest.fn();
const mockMonitorCtor = jest.fn(function(opts) {
  this.opts = opts;
  this.start = mockStart;
});

jest.mock('../../../lib/infrastructure/MemoryMonitor', () => mockMonitorCtor);

jest.mock('../../../infrastructure/logging/Logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const { createMemoryMonitor } = require('../../../server/memory');
const logger = require('../../../infrastructure/logging/Logger');

describe('createMemoryMonitor', () => {
  beforeEach(() => {
    mockMonitorCtor.mockClear();
    mockStart.mockClear();
    logger.error.mockClear();
  });

  test('instantiates MemoryMonitor with prod thresholds', () => {
    createMemoryMonitor();
    expect(mockMonitorCtor).toHaveBeenCalled();
    const opts = mockMonitorCtor.mock.calls[0][0];
    expect(opts.interval).toBe(60000);
    expect(opts.warningThresholdMB).toBe(256);
    expect(opts.criticalThresholdMB).toBe(512);
  });

  test('starts the monitor immediately', () => {
    createMemoryMonitor();
    expect(mockStart).toHaveBeenCalled();
  });

  test('onCritical logs + schedules process.exit(1)', () => {
    jest.useFakeTimers();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    createMemoryMonitor();
    const onCritical = mockMonitorCtor.mock.calls[0][0].onCritical;

    onCritical({ rss: 999 });
    expect(logger.error).toHaveBeenCalledWith(
      'Memory critical — scheduling graceful restart',
      { rss: 999 }
    );
    jest.advanceTimersByTime(5001);
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    jest.useRealTimers();
  });

  test('returns the monitor instance', () => {
    const result = createMemoryMonitor();
    expect(result).toBeDefined();
    expect(result.opts).toBeDefined();
  });
});
