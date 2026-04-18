'use strict';

/**
 * Ring buffer server-side pour replay des 30 dernières secondes.
 * Capacité : 30s × 60Hz = 1800 entrées (~9MB max à 5KB/delta).
 * Activé uniquement si ENABLE_REPLAY=true.
 */
class ReplayBuffer {
  constructor(capacity = 1800) {
    this._capacity = capacity;
    this._buf = new Array(capacity);
    this._head = 0;
    this._size = 0;
  }

  record(delta) {
    this._buf[this._head] = { ts: Date.now(), delta };
    this._head = (this._head + 1) % this._capacity;
    if (this._size < this._capacity) {
this._size++;
}
  }

  dump() {
    if (this._size === 0) {
return [];
}
    const start = this._size < this._capacity ? 0 : this._head;
    const out = new Array(this._size);
    for (let i = 0; i < this._size; i++) {
      out[i] = this._buf[(start + i) % this._capacity];
    }
    return out;
  }
}

module.exports = ReplayBuffer;
