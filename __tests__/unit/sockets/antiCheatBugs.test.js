/**
 * Regression tests for three anti-cheat bugs:
 *   1. False positive: legitimate players with speedMultiplier > 5 were disconnected.
 *   2. Counter overflow: movement_corrections_total was unbounded (no Math.min cap).
 *   3. Slow-attack bypass: combined speedMultiplier * boostMultiplier in accrual was
 *      uncapped, allowing a stopped player to accumulate a huge budget then teleport.
 */
'use strict';

function makeSocket() {
  const handlers = {};
  const emitted = [];
  return {
    id: 'sock-anticheat',
    emitted,
    on(ev, h) {
 handlers[ev] = h;
},
    emit(ev, d) {
 emitted.push({ event: ev, data: d });
},
    disconnect: jest.fn(),
    trigger(ev, payload) {
 handlers[ev](payload);
}
  };
}

function makePlayer(overrides = {}) {
  return {
    x: 500, y: 500,
    alive: true, hasNickname: true,
    lastMoveTime: Date.now() - 1000,
    moveBudget: 600,
    speedMultiplier: 1,
    speedBoost: null,
    ...overrides
  };
}

const roomManager = { checkWallCollision: () => false };

// ------------------------------------------------------------------ Bug 2
describe('Bug 2 – counter overflow prevention (CounterCollector)', () => {
  it('movement_corrections_total stays at MAX_SAFE_INTEGER after increment', () => {
    const CounterCollector = require('../../../infrastructure/metrics/CounterCollector');
    const counters = new CounterCollector();
    counters.anticheat.movement_corrections_total = Number.MAX_SAFE_INTEGER;
    counters.recordMovementCorrection();
    expect(counters.anticheat.movement_corrections_total).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ------------------------------------------------------------------ Bugs 1 & 3
// ENABLE_ANTICHEAT is read at module-load time, so we set env then reset modules.
describe('Anti-cheat flag tests (ENABLE_ANTICHEAT=true)', () => {
  let registerPlayerMoveHandler, SOCKET_EVENTS;

  beforeAll(() => {
    process.env.ENABLE_ANTICHEAT = 'true';
    jest.resetModules();

    jest.mock('../../../game/validationFunctions', () => ({
      validateMovementData: d => {
        if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') {
return null;
}
        return { x: d.x, y: d.y, angle: d.angle || 0 };
      }
    }));
    jest.mock('../../../sockets/rateLimitStore', () => ({ checkRateLimit: () => true }));
    jest.mock('../../../infrastructure/logging/Logger', () => ({
      warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn()
    }));
    jest.mock('../../../sockets/socketUtils', () => ({
      safeHandler: (_name, fn) => fn
    }));

    ({ registerPlayerMoveHandler } = require('../../../transport/websocket/handlers/playerMove'));
    ({ SOCKET_EVENTS } = require('../../../transport/websocket/events'));
  });

  afterAll(() => {
    delete process.env.ENABLE_ANTICHEAT;
    jest.resetModules();
  });

  // Bug 1a: speedMultiplier = 6 must NOT trigger anti-cheat (threshold raised from 5 to 10)
  it('Bug 1 – speedMultiplier=6 is tolerated (legit stacked upgrades, was false-positive)', () => {
    const socket = makeSocket();
    const player = makePlayer({ speedMultiplier: 6, moveBudget: 1e6 });
    const gameState = { players: { [socket.id]: player } };
    registerPlayerMoveHandler(socket, gameState, roomManager);

    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE, { x: 520, y: 500, angle: 0 });

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(player.speedMultiplier).toBe(6);
  });

  // Bug 1b: speedMultiplier > 10 is still suspicious
  it('Bug 1 – speedMultiplier=11 triggers flag and resets to 1', () => {
    const socket = makeSocket();
    const player = makePlayer({ speedMultiplier: 11, moveBudget: 1e6 });
    const gameState = { players: { [socket.id]: player } };
    registerPlayerMoveHandler(socket, gameState, roomManager);

    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE, { x: 510, y: 500, angle: 0 });

    expect(player.speedMultiplier).toBe(1);
  });

  // Bug 3: combined multiplier capped at MAX_ACCRUAL_MULTIPLIER=3
  it('Bug 3 – teleport rejected even with stacked speedMultiplier=4 + speedBoost active', () => {
    const socket = makeSocket();
    const player = makePlayer({
      x: 500, y: 500,
      speedMultiplier: 4,
      speedBoost: Date.now() + 30000, // ×2 boost → uncapped combined=8, now capped at 3
      moveBudget: 0,
      lastMoveTime: Date.now() - 500  // 500ms tick → max budget ≈ 675px
    });
    const gameState = { players: { [socket.id]: player } };
    registerPlayerMoveHandler(socket, gameState, roomManager);

    // 1500px move — exceeds 675px budget even with stacked multipliers.
    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE, { x: 2000, y: 500, angle: 0 });

    const correction = socket.emitted.find(e => e.event === SOCKET_EVENTS.SERVER.POSITION_CORRECTION);
    expect(correction).toBeDefined();
    expect(player.x).toBe(500);
  });
});
