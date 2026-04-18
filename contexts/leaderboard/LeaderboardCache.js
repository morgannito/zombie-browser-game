/**
 * LEADERBOARD CACHE
 * In-memory top-N cache with TTL, smart invalidation, activity tracking
 */

const TTL_MS = 10 * 60 * 1000; // 10 min
const IDLE_TTL_MS = 5 * 60 * 1000; // skip DB if not consulted in 5 min

class LeaderboardCache {
  constructor() {
    this._entries = null;
    this._expiresAt = 0;
    this._lastConsulted = 0;
    this._limit = null;
  }

  /**
   * Return cached entries for the given limit, or null on miss/stale/limit-mismatch.
   * @param {number} topN
   * @returns {Array|null}
   */
  get(topN) {
    this._lastConsulted = Date.now();
    if (
      this._entries &&
      Date.now() < this._expiresAt &&
      this._limit === topN
    ) {
      return this._entries;
    }
    return null;
  }

  /**
   * Store entries in cache for a specific limit.
   * @param {Array} entries
   * @param {number} limit
   */
  set(entries, limit) {
    this._entries = entries;
    this._limit = limit;
    this._expiresAt = Date.now() + TTL_MS;
  }

  /**
   * Whether the cache has been consulted recently (within IDLE_TTL_MS).
   * @returns {boolean}
   */
  isActive() {
    return this._lastConsulted > 0 && Date.now() - this._lastConsulted < IDLE_TTL_MS;
  }

  /**
   * Smart invalidation: only bust if newScore beats the lowest cached entry.
   * @param {number} newScore
   * @returns {boolean}
   */
  shouldInvalidate(newScore) {
    if (!this._entries || this._entries.length === 0) {
return true;
}
    const lowest = this._entries[this._entries.length - 1].score ?? 0;
    return newScore > lowest;
  }

  /** Bust the cache, forcing the next get() to hit the database. */
  invalidate() {
    this._entries = null;
    this._expiresAt = 0;
    this._limit = null;
  }
}

module.exports = LeaderboardCache;
