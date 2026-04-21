'use strict';

/**
 * Tests for NetworkManager shared-state broadcasting.
 *
 * AOI per-player filtering was removed for performance reasons. These tests
 * lock the current shared-broadcast contract and the simplified emit path.
 */

const NetworkManager = require('../../lib/server/NetworkManager');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGameState(players, zombies = {}) {
  return {
    players,
    zombies,
    bullets: {},
    particles: {},
    poisonTrails: {},
    explosions: {},
    powerups: {},
    loot: {},
    wave: 1,
    walls: {},
    currentRoom: 'room1',
    bossSpawned: false
  };
}

function makeMockIo(sockets = []) {
  const socketMap = new Map(sockets.map(s => [s.id, s]));
  const broadcastEmit = jest.fn();
  return {
    emit: jest.fn(),
    compress: jest.fn(() => ({ emit: broadcastEmit })),
    broadcastEmit,
    sockets: {
      sockets: socketMap
    },
    to: jest.fn(() => ({ emit: jest.fn() }))
  };
}

function makeSocket(id) {
  return { id, emit: jest.fn() };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER_A_ID = 'playerA';
const PLAYER_B_ID = 'playerB';

const playerA = { id: PLAYER_A_ID, x: 0, y: 0, health: 100 };
const playerB = { id: PLAYER_B_ID, x: 10000, y: 10000, health: 100 };

// Extra players keep the shape close to live lobbies, but shared broadcasting
// now ignores per-player AOI entirely.
const PADDING_PLAYERS = {
  pad1: { id: 'pad1', x: -50000, y: -50000, health: 100 },
  pad2: { id: 'pad2', x: -50000, y: 50000, health: 100 },
  pad3: { id: 'pad3', x: 50000, y: -50000, health: 100 }
};

// Distributed on purpose to prove there is no per-player filtering.
const z1 = { id: 'z1', x: 100, y: 100, health: 50 };
const z2 = { id: 'z2', x: 10100, y: 10100, health: 50 };
const z3 = { id: 'z3', x: 50000, y: 50000, health: 50 };

function makePlayersFixture() {
  return {
    [PLAYER_A_ID]: playerA,
    [PLAYER_B_ID]: playerB,
    ...PADDING_PLAYERS
  };
}

describe('_buildPublicState', () => {
  let nm;

  beforeEach(() => {
    const gameState = makeGameState(makePlayersFixture(), { z1, z2, z3 });
    nm = new NetworkManager(makeMockIo(), gameState);
  });

  test('includes every zombie regardless of player proximity', () => {
    const state = nm._buildPublicState();
    expect(state.zombies).toHaveProperty('z1');
    expect(state.zombies).toHaveProperty('z2');
    expect(state.zombies).toHaveProperty('z3');
  });

  test('sanitizes player identifiers before broadcasting', () => {
    nm.gameState.players[PLAYER_A_ID] = {
      id: PLAYER_A_ID,
      x: 10,
      y: 20,
      health: 100,
      sessionId: 'sess-1',
      socketId: 'socket-1',
      accountId: 'acct-1'
    };

    const state = nm._buildPublicState();
    expect(state.players[PLAYER_A_ID]).toEqual(
      expect.objectContaining({
        id: PLAYER_A_ID,
        x: 10,
        y: 20,
        health: 100
      })
    );
    expect(state.players[PLAYER_A_ID].sessionId).toBeUndefined();
    expect(state.players[PLAYER_A_ID].socketId).toBeUndefined();
    expect(state.players[PLAYER_A_ID].accountId).toBeUndefined();
  });

  test('keeps shared metadata and drops server-side particles', () => {
    const state = nm._buildPublicState();
    expect(state.wave).toBe(1);
    expect(state.currentRoom).toBe('room1');
    expect(state.bossSpawned).toBe(false);
    expect(state.particles).toEqual({});
  });
});

describe('emitGameState — shared broadcast without AOI filtering', () => {
  let socketA, socketB, mockIo, nm;

  beforeEach(() => {
    jest.useFakeTimers();

    socketA = makeSocket(PLAYER_A_ID);
    socketB = makeSocket(PLAYER_B_ID);
    const padSocket1 = makeSocket('pad1');
    const padSocket2 = makeSocket('pad2');
    const padSocket3 = makeSocket('pad3');

    const gameState = makeGameState(makePlayersFixture(), { z1, z2, z3 });

    mockIo = makeMockIo([socketA, socketB, padSocket1, padSocket2, padSocket3]);
    nm = new NetworkManager(mockIo, gameState);
    // Force full state on first call
    nm.fullStateCounter = nm.FULL_STATE_INTERVAL - 1;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('uses a shared compressed broadcast instead of per-socket emits', () => {
    nm.emitGameState();

    expect(socketA.emit).not.toHaveBeenCalled();
    expect(socketB.emit).not.toHaveBeenCalled();
    expect(mockIo.compress).toHaveBeenCalledWith(false);
    expect(mockIo.broadcastEmit).toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  test('full broadcast payload contains every zombie, not a per-player subset', () => {
    nm.emitGameState();

    const callArgs = mockIo.broadcastEmit.mock.calls[0];
    expect(callArgs[0]).toBe('gameState');
    const payload = callArgs[1];
    expect(payload.zombies).toHaveProperty('z1');
    expect(payload.zombies).toHaveProperty('z2');
    expect(payload.zombies).toHaveProperty('z3');
  });

  test('full state payload has full:true flag', () => {
    nm.emitGameState();
    const payload = mockIo.broadcastEmit.mock.calls[0][1];
    expect(payload.full).toBe(true);
  });

  test('delta is sent on subsequent tick', () => {
    nm.emitGameState(); // full state (tick 10)

    // Move z1 so there's a change to detect
    nm.gameState.zombies.z1 = { ...z1, x: 110 };

    nm.emitGameState(); // delta tick
    const deltaCall = mockIo.broadcastEmit.mock.calls.find(c => c[0] === 'gameStateDelta');
    expect(deltaCall).toBeDefined();
  });

  test('falls back to plain io.emit when compress helper is absent', () => {
    const emit = jest.fn();
    const io = { emit, sockets: { sockets: new Map() } };
    const gameState = makeGameState(makePlayersFixture(), { z1, z2, z3 });
    const instance = new NetworkManager(io, gameState);
    instance.fullStateCounter = instance.FULL_STATE_INTERVAL - 1;

    instance.emitGameState();

    expect(emit).toHaveBeenCalledWith(
      'gameState',
      expect.objectContaining({
        full: true,
        zombies: expect.objectContaining({
          z1: expect.any(Object),
          z2: expect.any(Object),
          z3: expect.any(Object)
        })
      })
    );
  });
});
