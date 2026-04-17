/**
 * REGRESSION — playerMoveBatch seq handling + moveAck
 *
 * Bug origin (audit round 2):
 *   - Client batch items had no seq number. Two batches arriving out of order
 *     would replay `x = player.x + dx` in the wrong order → incoherent position.
 *   - `PlayerController.lastAcknowledgedSequence` existed but the server NEVER
 *     sent an ACK back, making client-side prediction reconciliation impossible.
 *
 * Fix verified by these tests:
 *   - Each batch item carries a monotonically increasing `seq`.
 *   - Server drops items whose `seq <= player.lastMoveSeq`.
 *   - Server emits `moveAck` with `{seq, x, y}` after processing the batch.
 */
'use strict';

jest.mock('../../../game/validationFunctions', () => ({
  validateMovementData: data => {
    if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') {
      return null;
    }
    return { x: data.x, y: data.y, angle: data.angle || 0 };
  }
}));

jest.mock('../../../sockets/rateLimitStore', () => ({
  checkRateLimit: () => true
}));

jest.mock('../../../infrastructure/logging/Logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../infrastructure/metrics/MetricsCollector', () => ({
  getInstance: () => ({
    recordCheatAttempt: jest.fn(),
    recordMovementCorrection: jest.fn(),
    recordViolation: () => false,
    clearViolations: jest.fn(),
    metrics: { anticheat: { player_disconnects_total: 0 } }
  })
}));

const { registerPlayerMoveHandler } = require('../../../transport/websocket/handlers/playerMove');
const { SOCKET_EVENTS } = require('../../../transport/websocket/events');

function makeSocket() {
  const handlers = {};
  const emitted = [];
  return {
    id: 'socket-move',
    emitted,
    on(event, handler) {
      handlers[event] = handler;
    },
    emit(event, data) {
      emitted.push({ event, data });
    },
    disconnect() {},
    trigger(event, payload) {
      handlers[event](payload);
    }
  };
}

function makePlayer() {
  return {
    x: 200,
    y: 200,
    alive: true,
    hasNickname: true,
    lastMoveTime: Date.now(),
    moveBudget: 1e6,
    speedMultiplier: 1
  };
}

function makeRoomManager() {
  return { checkWallCollision: () => false };
}

describe('playerMoveBatch seq handling (regression)', () => {
  test('MOVE_ACK event name is defined', () => {
    expect(SOCKET_EVENTS.SERVER.MOVE_ACK).toBeDefined();
  });

  test('server ACKs the last processed seq after a batch', () => {
    const socket = makeSocket();
    const player = makePlayer();
    const gameState = { players: { [socket.id]: player } };
    registerPlayerMoveHandler(socket, gameState, makeRoomManager());

    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE_BATCH, [
      { dx: 1, dy: 0, angle: 0, seq: 1 },
      { dx: 1, dy: 0, angle: 0, seq: 2 },
      { dx: 1, dy: 0, angle: 0, seq: 3 }
    ]);

    const ack = socket.emitted.find(e => e.event === SOCKET_EVENTS.SERVER.MOVE_ACK);
    expect(ack).toBeDefined();
    expect(ack.data.seq).toBe(3);
    expect(ack.data.x).toBe(player.x);
    expect(ack.data.y).toBe(player.y);
    expect(player.lastMoveSeq).toBe(3);
  });

  test('server drops replayed / out-of-order seq items', () => {
    const socket = makeSocket();
    const player = makePlayer();
    const gameState = { players: { [socket.id]: player } };
    registerPlayerMoveHandler(socket, gameState, makeRoomManager());

    // First batch advances seq to 5.
    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE_BATCH, [
      { dx: 1, dy: 0, angle: 0, seq: 4 },
      { dx: 1, dy: 0, angle: 0, seq: 5 }
    ]);
    const xAfterFirst = player.x;
    expect(player.lastMoveSeq).toBe(5);

    // Replayed batch (seq 3-5) must be completely ignored.
    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE_BATCH, [
      { dx: 10, dy: 10, angle: 0, seq: 3 },
      { dx: 10, dy: 10, angle: 0, seq: 5 }
    ]);
    expect(player.x).toBe(xAfterFirst);
    expect(player.lastMoveSeq).toBe(5);
  });

  test('missing seq is tolerated (backward compatibility)', () => {
    const socket = makeSocket();
    const player = makePlayer();
    const gameState = { players: { [socket.id]: player } };
    registerPlayerMoveHandler(socket, gameState, makeRoomManager());

    socket.trigger(SOCKET_EVENTS.CLIENT.PLAYER_MOVE_BATCH, [
      { dx: 1, dy: 0, angle: 0 },
      { dx: 1, dy: 0, angle: 0 }
    ]);
    // Should not throw and should still process the moves.
    expect(player.x).toBeGreaterThan(200);
  });
});
