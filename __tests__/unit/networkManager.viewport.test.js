'use strict';

/**
 * Tests for per-player viewport-based AOI filtering in NetworkManager.
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
  return {
    emit: jest.fn(),
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

  test('player A sees z1 (nearby) but not z2 or z3', () => {
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.zombies).toHaveProperty('z1');
    expect(state.zombies).not.toHaveProperty('z2');
    expect(state.zombies).not.toHaveProperty('z3');
  });

  test('player B sees z2 (nearby) but not z1 or z3', () => {
    const state = nm._buildPublicStateForPlayer(PLAYER_B_ID);
    expect(state.zombies).not.toHaveProperty('z1');
    expect(state.zombies).toHaveProperty('z2');
    expect(state.zombies).not.toHaveProperty('z3');
  });

  test('players are always included unfiltered', () => {
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.players).toHaveProperty(PLAYER_A_ID);
    expect(state.players).toHaveProperty(PLAYER_B_ID);
  });

  test('falls back to full state when player position unknown', () => {
    const state = nm._buildPublicStateForPlayer('unknownSocket');
    // Full fallback: all zombies present
    expect(state.zombies).toHaveProperty('z1');
    expect(state.zombies).toHaveProperty('z2');
    expect(state.zombies).toHaveProperty('z3');
  });

  test('entity exactly on AOI boundary is included', () => {
    const boundaryZombie = { id: 'zBound', x: AOI_HALF_WIDTH, y: 0, health: 10 };
    nm.gameState.zombies.zBound = boundaryZombie;
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.zombies).toHaveProperty('zBound');
  });

  test('entity one pixel outside AOI is excluded', () => {
    const outsideZombie = { id: 'zOut', x: AOI_HALF_WIDTH + 1, y: 0, health: 10 };
    nm.gameState.zombies.zOut = outsideZombie;
    const state = nm._buildPublicStateForPlayer(PLAYER_A_ID);
    expect(state.zombies).not.toHaveProperty('zOut');
  });
});

// ---------------------------------------------------------------------------
// emitGameState — per-player socket.emit with filtered zombies
// ---------------------------------------------------------------------------

describe('emitGameState — per-player AOI filtering', () => {
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

  test('each socket receives a per-player emit (not io.emit broadcast)', () => {
    nm.emitGameState();

    expect(socketA.emit).toHaveBeenCalled();
    expect(socketB.emit).toHaveBeenCalled();
    // io.emit should NOT be called (per-player path)
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  test('player A receives gameState with z1 only', () => {
    nm.emitGameState();

    const callArgs = socketA.emit.mock.calls[0];
    expect(callArgs[0]).toBe('gameState');
    const payload = callArgs[1];
    expect(payload.zombies).toHaveProperty('z1');
    expect(payload.zombies).not.toHaveProperty('z2');
    expect(payload.zombies).not.toHaveProperty('z3');
  });

  test('player B receives gameState with z2 only', () => {
    nm.emitGameState();

    const callArgs = socketB.emit.mock.calls[0];
    expect(callArgs[0]).toBe('gameState');
    const payload = callArgs[1];
    expect(payload.zombies).not.toHaveProperty('z1');
    expect(payload.zombies).toHaveProperty('z2');
    expect(payload.zombies).not.toHaveProperty('z3');
  });

  test('full state payload has full:true flag', () => {
    nm.emitGameState();
    const payload = socketA.emit.mock.calls[0][1];
    expect(payload.full).toBe(true);
  });

  test('delta is sent on subsequent tick', () => {
    nm.emitGameState(); // full state (tick 10)

    // Move z1 so there's a change to detect
    nm.gameState.zombies.z1 = { ...z1, x: 110 };

    nm.emitGameState(); // delta tick
    const deltaCall = socketA.emit.mock.calls.find(c => c[0] === 'gameStateDelta');
    expect(deltaCall).toBeDefined();
  });

  test('cleanupPlayer removes per-player previous state', () => {
    nm.emitGameState();
    expect(nm.playerPreviousStates.get(PLAYER_A_ID)).toBeDefined();
    nm.cleanupPlayer(PLAYER_A_ID);
    expect(nm.playerPreviousStates.get(PLAYER_A_ID)).toBeUndefined();
  });
});
