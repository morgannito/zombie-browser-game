/**
 * DeltaBuilder — state diff / clone helpers extracted from NetworkManager.
 * Pure computation: no I/O, no Socket.IO dependency.
 */

// Static fields: sent only on first appearance (_new:true), never re-diffed.
const STATIC_FIELDS = new Set(['id', 'type', 'maxHealth', 'color', 'size', 'weaponType', 'name']);
// Server-internal fields: never sent to client.
const SERVER_INTERNAL_FIELDS = new Set([
  'lastMoveUpdate', '_prevX', '_prevY', 'staggerOffset',
  '_stuckFrames', '_lockedTargetId', 'lastCollisionCheck',
  'lastDamageTime', 'lastAttackTime', 'spawnTime',
  '_cachedNearestPlayer', '_cachedNearestPlayerDist', '_cacheTick',
  '_pathCache', '_pathTarget', '_lastPathfind',
  'randomMoveTimer', 'randomAngle', '_bossAbilityCooldowns', 'lastMoveTime',
  'lastShot', 'lastActivityTime', 'moveBudget', 'accountId', 'lastMoveSeq',
  'piercedZombies', 'createdAt'
]);
const DYNAMIC_FIELDS = new Set(['x', 'y', 'vx', 'vy', 'angle', 'health', 'state', 'isDead']);

const ENTITY_TYPES = ['players', 'zombies', 'bullets', 'particles', 'poisonTrails', 'explosions', 'powerups', 'loot'];

/** Quantise radian angle → 0-255 byte */
function quantiseAngle(rad) {
  const norm = ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((norm / (Math.PI * 2)) * 255) & 0xff;
}

class DeltaBuilder {
  constructor() {
    // Per-socket room tracking
    this._lastRoomIdBySocket = new Map();
    this._lastBroadcastRoomId = undefined;

    // Object pools: reuse allocations across ticks
    this._patchPool = [];
    this._patchPoolIdx = 0;
    this._snapPool = [];
    this._snapPoolIdx = 0;
  }

  /** Acquire a patch object from the pool (or allocate a new one). */
  _acquirePatch() {
    if (this._patchPoolIdx < this._patchPool.length) {
      return this._patchPool[this._patchPoolIdx++];
    }
    const obj = Object.create(null);
    this._patchPool.push(obj);
    this._patchPoolIdx++;
    return obj;
  }

  /** Acquire a snap object from the pool (or allocate a new one). */
  _acquireSnap() {
    if (this._snapPoolIdx < this._snapPool.length) {
      return this._snapPool[this._snapPoolIdx++];
    }
    const obj = Object.create(null);
    this._snapPool.push(obj);
    this._snapPoolIdx++;
    return obj;
  }

  /**
   * Reset both pools at the start of each delta calculation.
   * Clears all keys to undefined so V8 keeps the hidden class stable.
   */
  _releaseAll() {
    for (let i = 0; i < this._patchPoolIdx; i++) {
      const obj = this._patchPool[i];
      for (const k in obj) {
obj[k] = undefined;
}
    }
    this._patchPoolIdx = 0;
    for (let i = 0; i < this._snapPoolIdx; i++) {
      const obj = this._snapPool[i];
      for (const k in obj) {
obj[k] = undefined;
}
    }
    this._snapPoolIdx = 0;
  }

  /**
   * Build a field-level diff object for one entity.
   * @param {Object} cur
   * @param {Object|null} prev  null when entity is new
   * @returns {Object|null}
   */
  _fieldDiff(cur, prev) {
    if (!prev) {
      const patch = this._acquirePatch();
      for (const key in cur) {
patch[key] = cur[key];
}
      if (typeof patch.x === 'number') {
patch.x = Math.round(patch.x * 10) / 10;
}
      if (typeof patch.y === 'number') {
patch.y = Math.round(patch.y * 10) / 10;
}
      if (typeof patch.vx === 'number') {
patch.vx = Math.round(patch.vx * 10) / 10;
}
      if (typeof patch.vy === 'number') {
patch.vy = Math.round(patch.vy * 10) / 10;
}
      if (typeof patch.angle === 'number') {
patch.angle = quantiseAngle(patch.angle);
}
      patch._new = true;
      return patch;
    }

    const patch = this._acquirePatch();
    let changed = false;

    for (const key of DYNAMIC_FIELDS) {
      let val = cur[key];
      if (val === undefined) {
continue;
}

      if (key === 'x' || key === 'y') {
        val = Math.round(val * 10) / 10;
      } else if (key === 'vx' || key === 'vy') {
        val = Math.round(val * 10) / 10;
      } else if (key === 'angle') {
        val = quantiseAngle(val);
      }

      if (val !== prev[key]) {
        patch[key] = val;
        changed = true;
      }
    }

    for (const key in cur) {
      if (STATIC_FIELDS.has(key)) {
continue;
}
      if (SERVER_INTERNAL_FIELDS.has(key)) {
continue;
}
      if (DYNAMIC_FIELDS.has(key)) {
continue;
}
      if (key === '_new' || key === '_serverX' || key === '_serverY' || key === '_serverTime') {
continue;
}
      if (cur[key] !== prev[key]) {
        patch[key] = cur[key];
        changed = true;
      }
    }

    if (changed && typeof cur.x === 'number' && typeof cur.y === 'number') {
      if (patch.x === undefined) {
patch.x = Math.round(cur.x * 10) / 10;
}
      if (patch.y === undefined) {
patch.y = Math.round(cur.y * 10) / 10;
}
    }

    return changed ? patch : null;
  }

  /**
   * Calculate delta between two states.
   * @param {Object} current
   * @param {Object} previous
   * @param {Object} [authoritative]
   * @param {string|null} [socketId]
   * @returns {Object} { updated, removed, meta }
   */
  calculateDelta(current, previous, authoritative = null, socketId = null) {
    this._releaseAll();

    const delta = { updated: {}, removed: {}, meta: {} };
    for (let i = 0; i < ENTITY_TYPES.length; i++) {
      delta.updated[ENTITY_TYPES[i]] = {};
      delta.removed[ENTITY_TYPES[i]] = [];
    }

    for (let ti = 0; ti < ENTITY_TYPES.length; ti++) {
      const type = ENTITY_TYPES[ti];
      const currentEntities = current[type] || {};
      const previousEntities = previous[type] || {};
      const authoritativeEntities = authoritative ? authoritative[type] || {} : null;

      const updatedType = delta.updated[type];
      const removedType = delta.removed[type];

      for (const id in currentEntities) {
        const patch = this._fieldDiff(currentEntities[id], previousEntities[id] || null);
        if (patch !== null) {
updatedType[id] = patch;
}
      }

      for (const id in previousEntities) {
        if (!currentEntities[id]) {
          if (authoritativeEntities && authoritativeEntities[id]) {
continue;
}
          removedType.push(id);
        }
      }
    }

    const lastRoomId = socketId !== null
      ? this._lastRoomIdBySocket.get(socketId)
      : this._lastBroadcastRoomId;
    const roomChanged = current.currentRoom !== lastRoomId;
    if (roomChanged) {
      if (socketId !== null) {
        this._lastRoomIdBySocket.set(socketId, current.currentRoom);
      } else {
        this._lastBroadcastRoomId = current.currentRoom;
      }
    }
    delta.meta = {
      wave: current.wave,
      currentRoom: current.currentRoom,
      bossSpawned: current.bossSpawned,
      ...(roomChanged ? { walls: current.walls } : {})
    };

    return delta;
  }

  /**
   * Clone state for next-tick comparison.
   * @param {Object} state
   * @returns {Object}
   */
  cloneState(state) {
    const cloned = {
      wave: state.wave,
      currentRoom: state.currentRoom,
      bossSpawned: state.bossSpawned,
      walls: state.walls,
      players: {},
      zombies: {},
      bullets: {},
      particles: {},
      poisonTrails: {},
      explosions: {},
      powerups: {},
      loot: {}
    };

    for (const type of ENTITY_TYPES) {
      const entities = state[type];
      const clonedEntities = cloned[type];

      for (const id in entities) {
        const entity = entities[id];
        if (Array.isArray(entity)) {
          clonedEntities[id] = entity.slice();
        } else {
          const snap = this._acquireSnap();
          for (const key in entity) {
            if (STATIC_FIELDS.has(key)) {
continue;
}
            if (SERVER_INTERNAL_FIELDS.has(key)) {
continue;
}
            if (key === '_new' || key === '_serverX' || key === '_serverY' || key === '_serverTime') {
continue;
}
            snap[key] = entity[key];
          }
          // Store piercedZombies length only — avoids slice() alloc.
          // _fieldDiff never sees piercedZombies (SERVER_INTERNAL_FIELDS), so
          // this field is only used to detect set mutations via length change.
          if (entity.piercedZombies && Array.isArray(entity.piercedZombies)) {
            snap._piercedZombiesLen = entity.piercedZombies.length;
          }
          if (typeof snap.x === 'number') {
snap.x = Math.round(snap.x * 10) / 10;
}
          if (typeof snap.y === 'number') {
snap.y = Math.round(snap.y * 10) / 10;
}
          if (typeof snap.vx === 'number') {
snap.vx = Math.round(snap.vx * 10) / 10;
}
          if (typeof snap.vy === 'number') {
snap.vy = Math.round(snap.vy * 10) / 10;
}
          if (typeof snap.angle === 'number') {
snap.angle = quantiseAngle(snap.angle);
}
          clonedEntities[id] = snap;
        }
      }
    }

    return cloned;
  }

  /**
   * Estimate serialised payload size (sampled 1/60).
   * @param {object} payload
   * @returns {number}
   */
  _estimatePayloadBytes(payload) {
    this._byteSampleCounter = (this._byteSampleCounter || 0) + 1;
    if (this._byteSampleCounter % 60 !== 0) {
return 0;
}
    try {
      return Buffer.byteLength(JSON.stringify(payload), 'utf8');
    } catch (_) {
      return 0;
    }
  }

  /**
   * Cleanup per-socket state on disconnect.
   * @param {string} socketId
   */
  cleanupSocket(socketId) {
    this._lastRoomIdBySocket.delete(socketId);
  }

  /**
   * Reset all delta tracking state.
   */
  reset() {
    this._lastRoomIdBySocket.clear();
    this._lastBroadcastRoomId = undefined;
  }
}

module.exports = DeltaBuilder;
