/**
 * SKILL BONUS CACHE
 * In-memory cache for computed skill bonuses per player (TTL-based)
 * Avoids re-computing bonuses on every action
 */

const CACHE_TTL_MS = 60_000; // 60s

class SkillBonusCache {
  constructor(ttlMs = CACHE_TTL_MS) {
    this._ttl = ttlMs;
    this._cache = new Map(); // playerId -> { bonuses, expiresAt }
  }

  get(playerId) {
    const entry = this._cache.get(playerId);
    if (!entry) {
return null;
}
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(playerId);
      return null;
    }
    return entry.bonuses;
  }

  set(playerId, bonuses) {
    this._cache.set(playerId, { bonuses, expiresAt: Date.now() + this._ttl });
  }

  invalidate(playerId) {
    this._cache.delete(playerId);
  }

  clear() {
    this._cache.clear();
  }

  get size() {
    return this._cache.size;
  }
}

module.exports = SkillBonusCache;
