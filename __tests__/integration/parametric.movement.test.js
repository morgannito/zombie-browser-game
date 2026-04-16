/**
 * Parametric test — 100 random movement scenarios.
 * Each scenario is either accepted (returns validated data) or cleanly rejected
 * (returns null). No crashes, no exceptions.
 */

'use strict';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { validateMovementData } = require('../../game/validationFunctions');
const { createTestServer, connectAndInit, waitForEvent } = require('./testServerFactory');
const ConfigManager = require('../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

// ---------------------------------------------------------------------------
// Scenario generators
// ---------------------------------------------------------------------------

const ROOM_W = CONFIG.ROOM_WIDTH; // 3000
const ROOM_H = CONFIG.ROOM_HEIGHT; // 2400
const TWO_PI = Math.PI * 2;

/** Seed-based pseudo-random (deterministic) */
function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateScenarios(count) {
  const rand = seededRand(42);
  const scenarios = [];

  for (let i = 0; i < count; i++) {
    const type = i % 5;
    let x, y, angle;

    switch (type) {
      case 0: // valid interior
        x = rand() * ROOM_W;
        y = rand() * ROOM_H;
        angle = rand() * TWO_PI - Math.PI;
        break;
      case 1: // x out of bounds
        x = ROOM_W + rand() * 500 + 1;
        y = rand() * ROOM_H;
        angle = 0;
        break;
      case 2: // y out of bounds
        x = rand() * ROOM_W;
        y = ROOM_H + rand() * 500 + 1;
        angle = 0;
        break;
      case 3: // angle out of bounds
        x = rand() * ROOM_W;
        y = rand() * ROOM_H;
        angle = TWO_PI + rand() * 10 + 0.1;
        break;
      case 4: // negative coordinates
        x = -(rand() * 100 + 1);
        y = -(rand() * 100 + 1);
        angle = 0;
        break;
    }

    scenarios.push({ x, y, angle, type });
  }
  return scenarios;
}

// ---------------------------------------------------------------------------
// Unit-level parametric tests (no server needed — pure domain logic)
// ---------------------------------------------------------------------------

describe('parametric — 100 random movement scenarios via validateMovementData', () => {
  const scenarios = generateScenarios(100);

  test('test_parametric_all100_scenarios_return_object_or_null', () => {
    // Arrange + Act
    const results = scenarios.map(s => validateMovementData({ x: s.x, y: s.y, angle: s.angle }));

    // Assert — every result is either null or a plain object
    results.forEach(result => {
      const isNullOrObject = result === null || (typeof result === 'object' && result !== null);
      expect(isNullOrObject).toBe(true);
    });
  });

  test('test_parametric_valid_interior_scenarios_are_accepted', () => {
    // Arrange — only type=0 (valid interior)
    const validScenarios = scenarios.filter(s => s.type === 0);

    // Act + Assert — all must be non-null
    validScenarios.forEach(s => {
      const result = validateMovementData({ x: s.x, y: s.y, angle: s.angle });
      expect(result).not.toBeNull();
    });
  });

  test('test_parametric_x_out_of_bounds_scenarios_are_rejected', () => {
    // Arrange — only type=1 (x > ROOM_WIDTH)
    const invalidScenarios = scenarios.filter(s => s.type === 1);

    // Act + Assert — all must be null
    invalidScenarios.forEach(s => {
      const result = validateMovementData({ x: s.x, y: s.y, angle: s.angle });
      expect(result).toBeNull();
    });
  });

  test('test_parametric_y_out_of_bounds_scenarios_are_rejected', () => {
    // Arrange — only type=2 (y > ROOM_HEIGHT)
    const invalidScenarios = scenarios.filter(s => s.type === 2);

    // Act + Assert
    invalidScenarios.forEach(s => {
      const result = validateMovementData({ x: s.x, y: s.y, angle: s.angle });
      expect(result).toBeNull();
    });
  });

  test('test_parametric_angle_out_of_bounds_scenarios_are_rejected', () => {
    // Arrange — only type=3 (|angle| > 2π)
    const invalidScenarios = scenarios.filter(s => s.type === 3);

    // Act + Assert
    invalidScenarios.forEach(s => {
      const result = validateMovementData({ x: s.x, y: s.y, angle: s.angle });
      expect(result).toBeNull();
    });
  });

  test('test_parametric_negative_coords_scenarios_are_rejected', () => {
    // Arrange — only type=4 (x < 0, y < 0)
    const invalidScenarios = scenarios.filter(s => s.type === 4);

    // Act + Assert
    invalidScenarios.forEach(s => {
      const result = validateMovementData({ x: s.x, y: s.y, angle: s.angle });
      expect(result).toBeNull();
    });
  });

  test('test_parametric_accepted_results_have_exact_xyz_fields', () => {
    // Arrange — only valid scenarios
    const validScenarios = scenarios.filter(s => s.type === 0);

    // Act + Assert — returned object has correct shape and values
    validScenarios.forEach(s => {
      const result = validateMovementData({ x: s.x, y: s.y, angle: s.angle });
      expect(result).toHaveProperty('x', s.x);
      expect(result).toHaveProperty('y', s.y);
      expect(result).toHaveProperty('angle', s.angle);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration-level parametric test — 100 move events via socket
// ---------------------------------------------------------------------------

describe('parametric — 100 random playerMove events via socket', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createTestServer();
  }, 15000);

  afterAll(async () => {
    await ctx.stop();
  }, 10000);

  test('test_parametric_100_socket_playerMove_server_never_crashes', async () => {
    // Arrange — send invalid payloads (out-of-bounds coords); server must not crash
    // Player may be kicked by anti-cheat, but a new connection must succeed
    const { client } = await connectAndInit(ctx.createClient);
    client.emit('setNickname', { nickname: 'ParamMover' });
    await waitForEvent(client, 'playerNicknameSet');

    const rand = seededRand(99);
    // Act — emit 100 events with out-of-bounds coords (validation rejects them)
    for (let i = 0; i < 100; i++) {
      client.emit('playerMoveBatch', [
        {
          x: ROOM_W + rand() * 500 + 1, // always out of bounds → rejected
          y: ROOM_H + rand() * 500 + 1,
          angle: TWO_PI + rand() * 5 + 0.1
        }
      ]);
    }
    await new Promise(r => setTimeout(r, 400));
    client.disconnect();

    // Assert — server still alive: new connection works
    const { client: probe, initData } = await connectAndInit(ctx.createClient);
    expect(initData.playerId).toBeTruthy();
    probe.disconnect();
  });

  test('test_parametric_100_socket_playerMove_player_position_within_room_bounds', async () => {
    // Arrange — send only valid moves (small increments near spawn point)
    const { client, initData } = await connectAndInit(ctx.createClient);
    const playerId = initData.playerId;
    client.emit('setNickname', { nickname: 'BoundsCheck' });
    await waitForEvent(client, 'playerNicknameSet');

    // Get spawn position
    const spawnX = ctx.gameState.players[playerId].x;
    const spawnY = ctx.gameState.players[playerId].y;

    const rand = seededRand(77);
    // Act — send 100 valid moves within a small radius to avoid anti-cheat budget
    for (let i = 0; i < 100; i++) {
      const dx = (rand() - 0.5) * 10; // ±5 pixels
      const dy = (rand() - 0.5) * 10;
      client.emit('playerMoveBatch', [
        {
          x: Math.max(1, Math.min(ROOM_W - 1, spawnX + dx)),
          y: Math.max(1, Math.min(ROOM_H - 1, spawnY + dy)),
          angle: rand() * TWO_PI - Math.PI
        }
      ]);
    }
    await new Promise(r => setTimeout(r, 400));

    // Assert — final position is within room bounds
    const player = ctx.gameState.players[playerId];
    expect(player).toBeDefined();
    expect(player.x).toBeGreaterThanOrEqual(0);
    expect(player.x).toBeLessThanOrEqual(ROOM_W);
    expect(player.y).toBeGreaterThanOrEqual(0);
    expect(player.y).toBeLessThanOrEqual(ROOM_H);

    client.disconnect();
  });
});
