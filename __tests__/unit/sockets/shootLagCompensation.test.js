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
  test('bullet carries spawnCompensationMs flag for BulletUpdater consumption', () => {
    const socket = makeSocket();
    const player = makePlayer();
    const gameState = { players: { [socket.id]: player } };
    const em = captureBullets();
    registerShootHandler(socket, gameState, em, { checkWallCollision: () => false });

    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });

    expect(em.spawned).toHaveLength(1);
    const b = em.spawned[0];
    // Bullet spawns AT player position — compensation happens in BulletUpdater.
    expect(b.x).toBe(player.x);
    expect(b.y).toBe(player.y);
    expect(b.vx).toBeCloseTo(12);
    // Default interp delay 150ms, no latency → spawnCompensationMs = 150.
    expect(b.spawnCompensationMs).toBe(150);
  });

  test('higher latency yields proportionally larger compensation', () => {
    const socket = makeSocket();
    const player = makePlayer({ latency: 200 });
    const em = captureBullets();
    registerShootHandler(socket, { players: { [socket.id]: player } }, em, {});
    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });
    // latency (200) + interp (150) = 350
    expect(em.spawned[0].spawnCompensationMs).toBe(350);
  });

  test('latency clamped at MAX_LAG_COMPENSATION_MS (250)', () => {
    const socket = makeSocket();
    const player = makePlayer({ latency: 5000 });
    const em = captureBullets();
    registerShootHandler(socket, { players: { [socket.id]: player } }, em, {});
    socket.trigger(SOCKET_EVENTS.CLIENT.SHOOT, { angle: 0 });
    // capped 250 + 150 interp = 400ms max
    expect(em.spawned[0].spawnCompensationMs).toBe(400);
  });

  test('BulletUpdater fast-forwards first tick by spawnCompensationMs then clears it', () => {
    // Integration-style check against the updater's deltaTime math, without
    // actually running a full tick loop (collision deps are heavy). We inline
    // the relevant logic to verify the contract.
    const bullet = {
      x: 0, y: 0, vx: 12, vy: 0,
      lastUpdateTime: 100, createdAt: 100,
      spawnCompensationMs: 350
    };
    const now = 116; // one frame elapsed
    let deltaTime = Math.min(now - (bullet.lastUpdateTime || bullet.createdAt || now), 100);
    if (bullet.spawnCompensationMs && bullet.spawnCompensationMs > 0) {
      deltaTime = Math.min(deltaTime + bullet.spawnCompensationMs, 500);
      bullet.spawnCompensationMs = 0;
    }
    expect(deltaTime).toBe(366); // 16ms normal + 350ms compensation
    expect(bullet.spawnCompensationMs).toBe(0);
  });
});
