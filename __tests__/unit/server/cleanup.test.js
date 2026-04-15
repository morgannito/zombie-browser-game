/**
 * Unit tests for server/cleanup.js
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const {
  createCleanup,
  stopTimers,
  stopPerfIntegration,
  stopHazards
} = require('../../../server/cleanup');

describe('stopTimers', () => {
  test('invokes stopGameLoop + clears heartbeat + powerup', () => {
    const state = {
      stopGameLoop: jest.fn(),
      heartbeatTimer: 123,
      powerupSpawnerTimer: 456
    };
    stopTimers(state);
    expect(state.stopGameLoop).toBeNull();
    expect(state.heartbeatTimer).toBeNull();
    expect(state.powerupSpawnerTimer).toBeNull();
  });

  test('tolerates missing fields', () => {
    expect(() => stopTimers({})).not.toThrow();
  });
});

describe('stopPerfIntegration', () => {
  test('calls cleanup() when present', () => {
    const perf = { cleanup: jest.fn() };
    stopPerfIntegration(perf);
    expect(perf.cleanup).toHaveBeenCalled();
  });

  test('no-op when undefined', () => {
    expect(() => stopPerfIntegration(undefined)).not.toThrow();
    expect(() => stopPerfIntegration(null)).not.toThrow();
  });

  test('swallows cleanup errors', () => {
    const perf = { cleanup: jest.fn(() => { throw new Error('boom'); }) };
    expect(() => stopPerfIntegration(perf)).not.toThrow();
  });

  test('no-op when cleanup is not a function', () => {
    expect(() => stopPerfIntegration({ cleanup: 'not-a-fn' })).not.toThrow();
  });
});

describe('stopHazards', () => {
  test('calls hazardManager.clearAll()', () => {
    const gameState = { hazardManager: { clearAll: jest.fn() } };
    stopHazards(gameState);
    expect(gameState.hazardManager.clearAll).toHaveBeenCalled();
  });

  test('no-op when gameState missing', () => {
    expect(() => stopHazards(null)).not.toThrow();
    expect(() => stopHazards(undefined)).not.toThrow();
  });

  test('no-op when hazardManager missing', () => {
    expect(() => stopHazards({})).not.toThrow();
  });

  test('swallows clearAll errors', () => {
    const gameState = {
      hazardManager: { clearAll: jest.fn(() => { throw new Error('boom'); }) }
    };
    expect(() => stopHazards(gameState)).not.toThrow();
  });
});

describe('createCleanup', () => {
  function makeDeps() {
    return {
      io: { close: jest.fn(cb => cb && cb()) },
      server: { close: jest.fn(cb => cb && cb()) },
      dbManager: { close: jest.fn().mockResolvedValue(undefined) },
      perfIntegration: { cleanup: jest.fn() },
      memoryMonitor: { stop: jest.fn() },
      stopSessionCleanupInterval: jest.fn(),
      getState: () => ({ gameState: {} })
    };
  }

  test('returns {cleanupServer, install}', () => {
    const result = createCleanup(makeDeps());
    expect(typeof result.cleanupServer).toBe('function');
    expect(typeof result.install).toBe('function');
  });

  test('cleanupServer idempotent (second call is a no-op)', () => {
    const deps = makeDeps();
    // Skip the async close chain — prevent real process.exit
    deps.io.close = jest.fn(); // swallow the callback
    const { cleanupServer } = createCleanup(deps);
    jest.useFakeTimers();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    cleanupServer();
    deps.memoryMonitor.stop.mockClear();
    cleanupServer();
    expect(deps.memoryMonitor.stop).not.toHaveBeenCalled();
    exitSpy.mockRestore();
    jest.useRealTimers();
  });

  test('install() registers SIGTERM + SIGINT + uncaughtException + unhandledRejection', () => {
    const deps = makeDeps();
    const { install } = createCleanup(deps);
    const onSpy = jest.spyOn(process, 'on').mockImplementation(() => {});
    install();
    const events = onSpy.mock.calls.map(c => c[0]);
    expect(events).toContain('SIGTERM');
    expect(events).toContain('SIGINT');
    expect(events).toContain('uncaughtException');
    expect(events).toContain('unhandledRejection');
    onSpy.mockRestore();
  });
});
