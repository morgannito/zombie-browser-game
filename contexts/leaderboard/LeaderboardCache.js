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
  }

  get(topN) {
    this._lastConsulted = Date.now();
    if (this._entries && Date.now() < this._expiresAt) {
return this._entries;
}
    return null;
  }

  set(entries) {
    this._entries = entries;
    this._expiresAt = Date.now() + TTL_MS;
  }

  isActive() {
    return this._lastConsulted > 0 && Date.now() - this._lastConsulted < IDLE_TTL_MS;
  }

  /** Smart invalidation: only bust if newScore beats lowest cached entry */
  shouldInvalidate(newScore) {
    if (!this._entries || this._entries.length === 0) {
return true;
}
    const lowest = this._entries[this._entries.length - 1].score ?? 0;
    return newScore > lowest;
  }

  invalidate() {
    this._entries = null;
    this._expiresAt = 0;
  }
}

module.exports = LeaderboardCache;
