/**
 * EventBatchQueue — batches per-player socket events within a 16ms window.
 * Reduces round-trips by flushing N events as a single 'batchedEvents' message.
 */
class EventBatchQueue {
  constructor(io, flushInterval = 16) {
    this._io = io;
    this._queue = {}; // playerId -> {events: []}
    this._timer = null;
    this.FLUSH_INTERVAL = flushInterval;
  }

  /**
   * Queue an event for a player. If immediate=true, bypass batching.
   * @param {string} playerId
   * @param {string} event
   * @param {*} data
   * @param {boolean} immediate
   */
  queue(playerId, event, data, immediate = false) {
    if (immediate) {
      this._io.to(playerId).emit(event, data);
      return;
    }

    if (!this._queue[playerId]) {
      this._queue[playerId] = { events: [] };
    }
    this._queue[playerId].events.push({ event, data });

    if (!this._timer) {
      this._timer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  /**
   * Flush all queued events immediately.
   */
  flush() {
    for (const playerId in this._queue) {
      const batch = this._queue[playerId];
      if (batch.events.length > 0) {
        this._io.to(playerId).emit('batchedEvents', batch.events);
      }
    }
    this._queue = {};
    this._timer = null;
  }

  /**
   * Remove a player from the queue (on disconnect).
   * @param {string} playerId
   */
  cleanupPlayer(playerId) {
    if (this._queue[playerId]) {
      delete this._queue[playerId];
      if (this._timer) {
        let hasQueues = false;
        for (const _ in this._queue) { hasQueues = true; break; }
        if (!hasQueues) {
          clearTimeout(this._timer);
          this._timer = null;
        }
      }
    }
  }

  /** @returns {{queuedEvents: number, activePlayers: number}} */
  getStats() {
    let queuedEvents = 0;
    let activePlayers = 0;
    for (const id in this._queue) {
      queuedEvents += this._queue[id].events.length;
      activePlayers++;
    }
    return { queuedEvents, activePlayers };
  }

  cleanup() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._queue = {};
  }
}

module.exports = EventBatchQueue;
