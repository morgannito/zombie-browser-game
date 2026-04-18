/**
 * LEADERBOARD CACHE - Unit Tests
 * Covers TTL expiry, limit-mismatch stale fix, smart invalidation, idle tracking.
 */

const LeaderboardCache = require('../../../contexts/leaderboard/LeaderboardCache');

const ENTRIES_10 = Array.from({ length: 10 }, (_, i) => ({ score: 1000 - i * 10 }));
const ENTRIES_5 = ENTRIES_10.slice(0, 5);

describe('LeaderboardCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LeaderboardCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('get / set', () => {
    test('returns null when empty', () => {
      expect(cache.get(10)).toBeNull();
    });

    test('returns cached entries for matching limit', () => {
      cache.set(ENTRIES_10, 10);
      expect(cache.get(10)).toBe(ENTRIES_10);
    });

    test('returns null when limit differs (stale-limit bug fix)', () => {
      cache.set(ENTRIES_10, 10);
      expect(cache.get(5)).toBeNull();
    });

    test('returns null after TTL expires', () => {
      cache.set(ENTRIES_10, 10);
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      expect(cache.get(10)).toBeNull();
    });

    test('still valid just before TTL', () => {
      cache.set(ENTRIES_10, 10);
      jest.advanceTimersByTime(10 * 60 * 1000 - 1);
      expect(cache.get(10)).toBe(ENTRIES_10);
    });
  });

  describe('invalidate', () => {
    test('clears entries', () => {
      cache.set(ENTRIES_10, 10);
      cache.invalidate();
      expect(cache.get(10)).toBeNull();
    });

    test('clears stored limit so next set with any limit works', () => {
      cache.set(ENTRIES_10, 10);
      cache.invalidate();
      cache.set(ENTRIES_5, 5);
      expect(cache.get(5)).toBe(ENTRIES_5);
    });
  });

  describe('shouldInvalidate', () => {
    test('returns true when cache is empty', () => {
      expect(cache.shouldInvalidate(999)).toBe(true);
    });

    test('returns true when new score beats lowest entry', () => {
      cache.set(ENTRIES_10, 10); // lowest = 910 - 90 = 910? Actually 1000-9*10=910
      expect(cache.shouldInvalidate(ENTRIES_10[ENTRIES_10.length - 1].score + 1)).toBe(true);
    });

    test('returns false when new score does not beat lowest', () => {
      cache.set(ENTRIES_10, 10);
      expect(cache.shouldInvalidate(ENTRIES_10[ENTRIES_10.length - 1].score - 1)).toBe(false);
    });
  });

  describe('isActive', () => {
    test('false before any get()', () => {
      expect(cache.isActive()).toBe(false);
    });

    test('true immediately after get()', () => {
      cache.get(10);
      expect(cache.isActive()).toBe(true);
    });

    test('false after IDLE_TTL_MS without consultation', () => {
      cache.get(10);
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(cache.isActive()).toBe(false);
    });
  });
});
