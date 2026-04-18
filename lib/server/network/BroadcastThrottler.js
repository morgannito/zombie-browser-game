/**
 * BroadcastThrottler — latency-based throttle helpers extracted from NetworkManager.
 * Determines whether to skip a broadcast tick (global) or a per-socket emit.
 */

// Latency threshold above which broadcast rate is halved (graceful degradation)
const HIGH_LATENCY_THRESHOLD_MS = 500;

// Per-socket throttle threshold
const PER_SOCKET_LATENCY_THRESHOLD_MS = 150;

class BroadcastThrottler {
  constructor(playerLatenciesRef) {
    // Reference to NetworkManager.playerLatencies (shared object, not a copy)
    this._playerLatencies = playerLatenciesRef;
    this._socketSkipFlags = new Map();
  }

  /**
   * Compute average latency across all tracked players.
   * @returns {number} ms
   */
  getAverageLatency() {
    const players = Object.values(this._playerLatencies);
    if (players.length === 0) {
return 0;
}
    const total = players.reduce((sum, p) => sum + p.latency, 0);
    return Math.round(total / players.length);
  }

  /**
   * Global throttle multiplier based on average latency.
   * @returns {number} 1 = normal, 2 = throttled (50% FPS)
   */
  _broadcastThrottleMultiplier() {
    return this.getAverageLatency() > HIGH_LATENCY_THRESHOLD_MS ? 2 : 1;
  }

  /**
   * Per-socket adaptive throttle — alternate skip/emit for high-latency sockets.
   * Full-state keyframes bypass this in the caller.
   * @param {string} socketId
   * @returns {boolean} true = skip this socket
   */
  _shouldSkipSocket(socketId) {
    const latencyEntry = this._playerLatencies[socketId];
    if (!latencyEntry || latencyEntry.latency <= PER_SOCKET_LATENCY_THRESHOLD_MS) {
      return false;
    }
    const skip = this._socketSkipFlags.get(socketId) || false;
    this._socketSkipFlags.set(socketId, !skip);
    return skip;
  }

  /**
   * Cleanup per-socket skip flag on disconnect.
   * @param {string} socketId
   */
  cleanupSocket(socketId) {
    this._socketSkipFlags.delete(socketId);
  }
}

module.exports = BroadcastThrottler;
