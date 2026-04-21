'use strict';

/**
 * Tests for NetworkManager shared-state broadcasting.
 *
 * AOI per-player filtering was removed for performance reasons. These tests
 * lock the current shared-broadcast contract so stale AOI-specific assertions
 * do not stay skipped forever.
 */

const NetworkManager = require('../../lib/server/NetworkManager');
const { AOI_HALF_WIDTH, AOI_HALF_HEIGHT } = require('../../lib/server/NetworkManager');

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

// AOI filtering only activates with ≥5 concurrent players (small-lobby fast-path
// bypasses it). Pad with three idle players parked off-grid so they do not
// influence A/B AOI windows.
const PADDING_PLAYERS = {
  pad1: { id: 'pad1', x: -50000, y: -50000, health: 100 },
  pad2: { id: 'pad2', x: -50000, y: 50000, health: 100 },
  pad3: { id: 'pad3', x: 50000, y: -50000, health: 100 }
};

// z1: near player A (within AOI)
const z1 = { id: 'z1', x: 100, y: 100, health: 50 };
// z2: near player B (far from A)
const z2 = { id: 'z2', x: 10100, y: 10100, health: 50 };
// z3: far from both
const z3 = { id: 'z3', x: 50000, y: 50000, health: 50 };

function makePlayersFixture() {
  return {
    [PLAYER_A_ID]: playerA,
    [PLAYER_B_ID]: playerB,
    ...PADDING_PLAYERS
  };
}

// ---------------------------------------------------------------------------
// AOI constant exports
// ---------------------------------------------------------------------------

describe('AOI constants', () => {
  test('AOI_HALF_WIDTH is a positive number', () => {
    expect(typeof AOI_HALF_WIDTH).toBe('number');
    expect(AOI_HALF_WIDTH).toBeGreaterThan(0);
  });

  test('AOI_HALF_HEIGHT is a positive number', () => {
    expect(typeof AOI_HALF_HEIGHT).toBe('number');
    expect(AOI_HALF_HEIGHT).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// _buildPublicStateForPlayer
// ---------------------------------------------------------------------------

describe('_buildPublicStateForPlayer', () => {
  let nm;

  beforeEach(() => {
    const gameState = makeGameState(makePlayersFixture(), { z1, z2, z3 });
    nm = new NetworkManager(makeMockIo(), gameState);
  });

  test('player A receives the shared zombie state without AOI filtering', () => {
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.zombies).toHaveProperty('z1');
    expect(state.zombies).toHaveProperty('z2');
    expect(state.zombies).toHaveProperty('z3');
  });

  test('player B also receives the same shared zombie state', () => {
    const state = nm._buildPublicStateForPlayer(PLAYER_B_ID);
    expect(state.zombies).toHaveProperty('z1');
    expect(state.zombies).toHaveProperty('z2');
    expect(state.zombies).toHaveProperty('z3');
  });

  test('players are always included unfiltered', () => {
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.players).toHaveProperty(PLAYER_A_ID);
    expect(state.players).toHaveProperty(PLAYER_B_ID);
  });

  test('uses sanitized players when they are provided explicitly', () => {
    const sanitizedPlayers = {
      [PLAYER_A_ID]: { id: PLAYER_A_ID, x: 1, y: 2, health: 50 }
    };
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID, sanitizedPlayers);
    expect(state.players).toEqual(sanitizedPlayers);
  });

  test('falls back to full state when player position unknown', () => {
    const state = nm._buildPublicStateForPlayer('unknownSocket');
    expect(state.zombies).toHaveProperty('z1');
    expect(state.zombies).toHaveProperty('z2');
    expect(state.zombies).toHaveProperty('z3');
  });

  test('AOI boundaries no longer affect included zombies', () => {
    const boundaryZombie = { id: 'zBound', x: AOI_HALF_WIDTH, y: 0, health: 10 };
    const outsideZombie = { id: 'zOut', x: AOI_HALF_WIDTH + 1, y: 0, health: 10 };
    nm.gameState.zombies.zBound = boundaryZombie;
    nm.gameState.zombies.zOut = outsideZombie;
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.zombies).toHaveProperty('zBound');
    expect(state.zombies).toHaveProperty('zOut');
  });
});

// ---------------------------------------------------------------------------
// emitGameState — per-player socket.emit with filtered zombies
// ---------------------------------------------------------------------------

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

  test('cleanupPlayer removes per-player previous state', () => {
    nm.playerPreviousStates.set(PLAYER_A_ID, { players: {}, zombies: {} });
    expect(nm.playerPreviousStates.get(PLAYER_A_ID)).toBeDefined();
    nm.cleanupPlayer(PLAYER_A_ID);
    expect(nm.playerPreviousStates.get(PLAYER_A_ID)).toBeUndefined();
  });
});
