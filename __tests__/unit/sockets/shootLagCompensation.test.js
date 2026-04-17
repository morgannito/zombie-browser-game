/**
 * REGRESSION — bullet spawn lag compensation
 *
 * Bug symptom (audit round 3):
 *   Distant zombies absorbed bullets visually without taking damage. Root cause
 *   was the 150ms client interpolation buffer + RTT: the player aims at a
 *   zombie's PAST position, the server spawns the bullet at player.x/y, and
 *   by the time the bullet arrives the zombie has moved. Hits visually, misses
 *   on the server.
 *
 * Fix: at shoot time, advance the bullet spawn along its velocity by
 * (player.latency + CLIENT_INTERP_DELAY_MS) worth of travel, clamped to a safe
 * maximum and stopped at walls.
 */
'use strict';

jest.mock('../../../game/validationFunctions', () => ({
  validateShootData: d => d && typeof d.angle === 'number' ? d : null
}));

jest.mock('../../../sockets/rateLimitStore', () => ({
  checkRateLimit: () => true
}));

jest.mock('../../../infrastructure/logging/Logger', () => ({
  warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn()
}));

jest.mock('../../../infrastructure/metrics/MetricsCollector', () => ({
  getInstance: () => ({
    recordCheatAttempt: jest.fn(),
    recordViolation: () => false,
    clearViolations: jest.fn(),
    metrics: { anticheat: { player_disconnects_total: 0 } }
  })
}));

jest.mock('../../../lib/server/ConfigManager', () => ({
  CONFIG: { ROOM_WIDTH: 5000, ROOM_HEIGHT: 5000, BULLET_SIZE: 4 },
  WEAPONS: {
    pistol: {
      damage: 25,
      fireRate: 0,
      bulletSpeed: 12,
      bulletCount: 1,
      spread: 0,
      color: '#fff',
      bulletSize: 4
    }
  }
}));

const { registerShootHandler } = require('../../../transport/websocket/handlers/shoot');
const { SOCKET_EVENTS } = require('../../../transport/websocket/events');

function makeSocket() {
  const handlers = {};
  return {
    id: 'sh-1',
    on(event, handler) { handlers[event] = handler; },
    emit: jest.fn(),
    disconnect: jest.fn(),
    trigger(event, payload) { handlers[event](payload); }
  };
}

function makePlayer(overrides = {}) {
  return {
    x: 1000,
    y: 1000,
    alive: true,
    hasNickname: true,
    weapon: 'pistol',
    lastShot: 0,
    lastActivityTime: 0,
    extraBullets: 0,
    ...overrides
  };
}

function captureBullets() {
  const spawned = [];
  return {
    createBullet(b) { spawned.push({ ...b }); },
    spawned
  };
}

describe('shoot handler lag compensation (regression)', () => {
  test('bullet spawned at player position when latency is 0 still gets default interp compensation', () => {
    const socket = makeSocket();
    const player = makePlayer();
    const gameState = { players: { [socket.id]: player } };
    const em = captureBullets();
    registerShootHandler(socket, gameState, em, { checkWallCollision: () => false });

    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });

    expect(em.spawned).toHaveLength(1);
    const b = em.spawned[0];
    // 150ms interp delay at 60Hz ≈ 9 frames × 12 px/frame = 108px advance along +X.
    expect(b.x).toBeGreaterThan(player.x);
    expect(b.x).toBeLessThan(player.x + 200);
    expect(b.y).toBe(player.y);
    expect(b.vx).toBeCloseTo(12);
  });

  test('higher latency produces proportionally larger spawn advance', () => {
    const socket = makeSocket();
    const player = makePlayer({ latency: 200 });
    const em = captureBullets();
    registerShootHandler(socket, { players: { [socket.id]: player } }, em, {
      checkWallCollision: () => false
    });
    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });
    // (200 + 150)ms ≈ 21 frames × 12 = ~252 px advance.
    expect(em.spawned[0].x - player.x).toBeGreaterThan(200);
  });

  test('latency clamped at MAX_LAG_COMPENSATION_MS (250)', () => {
    const socket = makeSocket();
    const player = makePlayer({ latency: 5000 }); // abusive
    const em = captureBullets();
    registerShootHandler(socket, { players: { [socket.id]: player } }, em, {
      checkWallCollision: () => false
    });
    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });
    // Capped compensation = 250 + 150 = 400ms → 24 frames × 12 = 288 px max.
    expect(em.spawned[0].x - player.x).toBeLessThan(320);
  });

  test('walls stop the lag-compensated spawn (no warping through geometry)', () => {
    const socket = makeSocket();
    const player = makePlayer({ latency: 200 });
    const em = captureBullets();
    // Wall intercepts after 30px of travel.
    const roomManager = {
      checkWallCollision: (x) => x - player.x > 30
    };
    registerShootHandler(socket, { players: { [socket.id]: player } }, em, roomManager);
    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });
    expect(em.spawned[0].x - player.x).toBeLessThan(60);
  });
});
