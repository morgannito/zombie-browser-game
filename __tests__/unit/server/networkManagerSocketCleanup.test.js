/**
 * REGRESSION — NetworkManager._socketSkipFlags cleanup
 *
 * Bug origin (audit round 2):
 *   `_shouldSkipSocket` used to set `this[`_skip_${socketId}`] = ...` on the
 *   NetworkManager instance itself. Those dynamic props were never cleared on
 *   disconnect → slow memory leak (one prop per socket ever connected).
 *
 * Fix: per-socket throttle state moved to a `Map` cleared in `cleanupPlayer`.
 */
'use strict';

describe('NetworkManager socket throttle state cleanup (regression)', () => {
  let NM;

  beforeAll(() => {
    jest.mock('../../../infrastructure/logging/Logger', () => ({
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    }));
    NM = require('../../../lib/server/NetworkManager');
  });

  function makeInstance() {
    const ctor = NM.NetworkManager || NM;
    const gameState = { players: {}, zombies: {}, bullets: {}, walls: [] };
    const io = { emit: jest.fn(), sockets: { sockets: new Map() } };
    const instance = new ctor(gameState, io);
    return instance;
  }

  test('never stores dynamic _skip_ props on the instance', () => {
    const nm = makeInstance();
    nm.playerLatencies['sock-A'] = { latency: 250 };
    nm._shouldSkipSocket('sock-A');
    nm._shouldSkipSocket('sock-A');
    const leakedKeys = Object.keys(nm).filter(k => k.startsWith('_skip_'));
    expect(leakedKeys).toHaveLength(0);
  });

  test('cleanupPlayer removes the per-socket throttle entry', () => {
    const nm = makeInstance();
    nm.playerLatencies['sock-B'] = { latency: 300 };
    nm._shouldSkipSocket('sock-B');
    const flags = nm._throttler ? nm._throttler._socketSkipFlags : nm._socketSkipFlags;
    expect(flags.has('sock-B')).toBe(true);
    nm.cleanupPlayer('sock-B');
    expect(flags.has('sock-B')).toBe(false);
  });

  test('fast-latency sockets are never tracked in throttle Map', () => {
    const nm = makeInstance();
    nm.playerLatencies['sock-C'] = { latency: 50 }; // below threshold
    const res = nm._shouldSkipSocket('sock-C');
    expect(res).toBe(false);
    // Map is lazy-created only when an actual throttle decision is made.
    const flags = nm._throttler ? nm._throttler._socketSkipFlags : nm._socketSkipFlags;
    if (flags) {
      expect(flags.has('sock-C')).toBe(false);
    }
  });
});
