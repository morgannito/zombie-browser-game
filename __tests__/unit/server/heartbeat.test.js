/**
 * Unit tests for server/heartbeat.js
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const {
  startHeartbeat,
  isOrphan,
  ensureActivityTimestamp,
  scanPlayers,
  evictPlayers
} = require('../../../server/heartbeat');

describe('isOrphan', () => {
  test('null / undefined → true', () => {
    expect(isOrphan(null)).toBe(true);
    expect(isOrphan(undefined)).toBe(true);
  });
  test('non-object → true', () => {
    expect(isOrphan('string')).toBe(true);
    expect(isOrphan(42)).toBe(true);
  });
  test('valid object → false', () => {
    expect(isOrphan({ nickname: 'x' })).toBe(false);
  });
});

describe('ensureActivityTimestamp', () => {
  test('bootstraps when missing', () => {
    const player = { nickname: 'p1' };
    const ok = ensureActivityTimestamp(player, 1000);
    expect(player.lastActivityTime).toBe(1000);
    expect(ok).toBe(false); // signals: just initialized, skip this pass
  });

  test('noop when already numeric', () => {
    const player = { lastActivityTime: 500 };
    expect(ensureActivityTimestamp(player, 2000)).toBe(true);
    expect(player.lastActivityTime).toBe(500);
  });

  test('bootstraps when non-number', () => {
    const player = { lastActivityTime: 'bad' };
    ensureActivityTimestamp(player, 1000);
    expect(player.lastActivityTime).toBe(1000);
  });
});

describe('scanPlayers', () => {
  function makeIO() {
    return { sockets: { sockets: new Map() } };
  }

  test('marks orphaned entries for deletion', () => {
    const gameState = { players: { p1: null, p2: { lastActivityTime: Date.now() } } };
    const { playersToDelete, orphanedObjects } = scanPlayers(gameState, makeIO(), 60000, Date.now());
    expect(playersToDelete).toContain('p1');
    expect(orphanedObjects).toBe(1);
  });

  test('evicts timed-out players', () => {
    const now = 10000;
    const gameState = {
      players: {
        p1: { lastActivityTime: now - 120000, nickname: 'old' }
      }
    };
    const { playersToDelete, cleanedUp } = scanPlayers(gameState, makeIO(), 60000, now);
    expect(playersToDelete).toContain('p1');
    expect(cleanedUp).toBe(1);
  });

  test('keeps active players', () => {
    const now = 10000;
    const gameState = {
      players: {
        p1: { lastActivityTime: now - 100, nickname: 'active' }
      }
    };
    const result = scanPlayers(gameState, makeIO(), 60000, now);
    expect(result.playersToDelete).toEqual([]);
    expect(result.cleanedUp).toBe(0);
  });

  test('skips first-seen players (bootstrap tick)', () => {
    const gameState = { players: { p1: {} } };
    const result = scanPlayers(gameState, makeIO(), 60000, 1000);
    expect(result.playersToDelete).toEqual([]);
    expect(gameState.players.p1.lastActivityTime).toBe(1000);
  });
});

describe('evictPlayers', () => {
  test('removes player ids from gameState + calls networkManager cleanup', () => {
    const gameState = { players: { p1: {}, p2: {}, p3: {} } };
    const nm = { cleanupPlayer: jest.fn() };
    evictPlayers(gameState, nm, ['p1', 'p3']);
    expect(gameState.players).toEqual({ p2: {} });
    expect(nm.cleanupPlayer).toHaveBeenCalledWith('p1');
    expect(nm.cleanupPlayer).toHaveBeenCalledWith('p3');
  });

  test('tolerates null networkManager', () => {
    const gameState = { players: { p1: {} } };
    expect(() => evictPlayers(gameState, null, ['p1'])).not.toThrow();
    expect(gameState.players.p1).toBeUndefined();
  });
});

describe('startHeartbeat', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('returns timer + stop', () => {
    const result = startHeartbeat({
      gameState: { players: {} },
      io: { sockets: { sockets: new Map() } },
      networkManager: null,
      metricsCollector: null,
      inactivityTimeout: 60000,
      interval: 5000
    });
    expect(result.timer).toBeDefined();
    expect(typeof result.stop).toBe('function');
    result.stop();
  });

  test('interval triggers scan + evict', () => {
    const cleanup = jest.fn();
    const gameState = {
      players: {
        p1: { lastActivityTime: Date.now() - 120000, nickname: 'stale' }
      }
    };
    const { stop } = startHeartbeat({
      gameState,
      io: { sockets: { sockets: new Map() } },
      networkManager: { cleanupPlayer: cleanup },
      metricsCollector: { recordCleanup: jest.fn() },
      inactivityTimeout: 60000,
      interval: 1000
    });
    jest.advanceTimersByTime(1100);
    expect(gameState.players.p1).toBeUndefined();
    expect(cleanup).toHaveBeenCalledWith('p1');
    stop();
  });
});
