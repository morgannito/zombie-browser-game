/**
 * COUNTER COLLECTOR
 * Gère les compteurs jeu : kills, shots, hits, connections, anticheat, violations
 */

class CounterCollector {
  constructor() {
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.connections = 0;

    this.anticheat = {
      cheat_attempts_total: {},
      rate_limit_blocks_total: {},
      movement_corrections_total: 0,
      player_disconnects_total: 0
    };

    this.violationTracker = new Map();
    this.VIOLATION_THRESHOLD = 10;
    this.VIOLATION_WINDOW_MS = 60000;
  }

  /** @param {number} [count=1] */
  incrementKills(count = 1)       { this.kills       = Math.min(this.kills       + count, Number.MAX_SAFE_INTEGER); }
  /** @param {number} [count=1] */
  incrementShots(count = 1)       { this.shots       = Math.min(this.shots       + count, Number.MAX_SAFE_INTEGER); }
  /** @param {number} [count=1] */
  incrementHits(count = 1)        { this.hits        = Math.min(this.hits        + count, Number.MAX_SAFE_INTEGER); }
  /** @param {number} [count=1] */
  incrementConnections(count = 1) { this.connections = Math.min(this.connections + count, Number.MAX_SAFE_INTEGER); }

  recordCheatAttempt(type) {
    const b = this.anticheat.cheat_attempts_total;
    b[type] = (b[type] || 0) + 1;
  }

  recordRateLimitBlock(event) {
    const b = this.anticheat.rate_limit_blocks_total;
    b[event] = (b[event] || 0) + 1;
  }

  /**
   * Increment movement corrections counter, capped at MAX_SAFE_INTEGER to
   * prevent integer overflow on long-running servers.
   */
  recordMovementCorrection() {
    this.anticheat.movement_corrections_total = Math.min(
      this.anticheat.movement_corrections_total + 1,
      Number.MAX_SAFE_INTEGER
    );
  }

  recordViolation(socketId) {
    const now = Date.now();
    const entry = this.violationTracker.get(socketId);
    if (!entry || now - entry.windowStart > this.VIOLATION_WINDOW_MS) {
      this.violationTracker.set(socketId, { count: 1, windowStart: now });
      return false;
    }
    entry.count++;
    return entry.count >= this.VIOLATION_THRESHOLD;
  }

  clearViolations(socketId) {
    this.violationTracker.delete(socketId);
  }

  reset() {
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.connections = 0;
    this.anticheat.cheat_attempts_total = {};
    this.anticheat.rate_limit_blocks_total = {};
    this.anticheat.movement_corrections_total = 0;
    this.anticheat.player_disconnects_total = 0;
    this.violationTracker.clear();
  }
}

module.exports = CounterCollector;
