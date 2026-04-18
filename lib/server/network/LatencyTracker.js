/**
 * LatencyTracker — tracks per-player RTT samples and exposes latency stats.
 * Decoupled from NetworkManager so BroadcastThrottler can depend on it directly.
 */
class LatencyTracker {
  constructor(maxSamples = 10) {
    this.MAX_SAMPLES = maxSamples;
    this._latencies = {}; // playerId -> {latency, lastPing, samples: []}
  }

  /**
   * Expose the raw latencies map (read-only intent) for BroadcastThrottler compat.
   * @returns {Object}
   */
  get latencies() {
    return this._latencies;
  }

  /**
   * Record an RTT sample for a player.
   * @param {string} playerId
   * @param {number} rtt  milliseconds
   */
  record(playerId, rtt) {
    if (!this._latencies[playerId]) {
      this._latencies[playerId] = { latency: rtt, lastPing: Date.now(), samples: [] };
    }
    const entry = this._latencies[playerId];
    entry.samples.push(rtt);
    if (entry.samples.length > this.MAX_SAMPLES) {
      entry.samples.shift();
    }
    entry.latency = entry.samples.reduce((a, b) => a + b, 0) / entry.samples.length;
    entry.lastPing = Date.now();
  }

  /**
   * Get latency stats for a player.
   * @param {string} playerId
   * @returns {{latency: number, samples: number, avg: number, min: number, max: number}}
   */
  getStats(playerId) {
    const stats = this._latencies[playerId];
    if (!stats || stats.samples.length === 0) {
      return { latency: 0, samples: 0, avg: 0, min: 0, max: 0 };
    }
    const s = stats.samples;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < s.length; i++) {
      if (s[i] < min) {
min = s[i];
}
      if (s[i] > max) {
max = s[i];
}
    }
    return { latency: stats.latency, samples: s.length, avg: stats.latency, min, max };
  }

  /**
   * Remove a player's latency data.
   * @param {string} playerId
   */
  cleanupPlayer(playerId) {
    delete this._latencies[playerId];
  }

  cleanup() {
    this._latencies = {};
  }
}

module.exports = LatencyTracker;
