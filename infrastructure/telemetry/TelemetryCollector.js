/**
 * @fileoverview Telemetry collector — anonymous gameplay event aggregation.
 * Singleton. No PII: only event types and counts are stored.
 */

const RING_BUFFER_SIZE = 1000;
const TOP_N = 10;

const VALID_EVENTS = new Set([
  'kill', 'death', 'level_up', 'wave_complete',
  'weapon_change', 'upgrade_select', 'boss_kill'
]);

class TelemetryCollector {
  constructor() {
    this._buffer = new Array(RING_BUFFER_SIZE);
    this._head = 0;
    this._count = 0;
    this._counts = {};
  }

  /**
   * Record a gameplay event into the ring buffer.
   * @param {string} eventType
   * @param {Object} [payload]
   */
  record(eventType, _payload = {}) {
    if (!VALID_EVENTS.has(eventType)) {
return;
}

    const entry = { type: eventType, ts: Date.now() };
    this._buffer[this._head] = entry;
    this._head = (this._head + 1) % RING_BUFFER_SIZE;
    if (this._count < RING_BUFFER_SIZE) {
this._count++;
}

    this._counts[eventType] = (this._counts[eventType] || 0) + 1;
  }

  /**
   * Returns aggregated stats: counts per type + top 10 events by count.
   * @returns {Object}
   */
  getStats() {
    const top10 = Object.entries(this._counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([type, count]) => ({ type, count }));

    return {
      totalRecorded: this._count,
      counts: { ...this._counts },
      top10
    };
  }
}

/** @type {TelemetryCollector} */
let instance = null;

function getTelemetryCollector() {
  if (!instance) {
instance = new TelemetryCollector();
}
  return instance;
}

module.exports = { TelemetryCollector, getTelemetryCollector };
