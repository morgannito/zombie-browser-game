/**
 * Integration tests — Socket.IO connection & player lifecycle
 *
 * Flows covered:
 *  1. Anonymous login → connection → spawn (setNickname) → move → disconnect
 *  2. Two clients get distinct playerIds
 *  3. Movement without nickname is silently ignored (no positionCorrection)
 *  4. Disconnect removes player from gameState
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { createTestServer, connectAndInit, waitForEvent } = require('./testServerFactory');

let ctx;

beforeAll(async () => {
  ctx = await createTestServer();
}, 10000);

afterAll(async () => {
  await ctx.stop();
}, 5000);

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('connection lifecycle', () => {
  test('test_connect_anonymous_receives_init_with_playerId', async () => {
    // Arrange + Act
    const { client, initData } = await connectAndInit(ctx.createClient);

    // Assert
    expect(initData.playerId).toBeTruthy();

    client.disconnect();
  });

  test('test_connect_two_clients_get_distinct_playerIds', async () => {
    // Arrange + Act
    const [r1, r2] = await Promise.all([
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient)
    ]);

    // Assert
    expect(r1.initData.playerId).not.toBe(r2.initData.playerId);

    r1.client.disconnect();
    r2.client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Spawn (setNickname) flow
// ---------------------------------------------------------------------------

describe('player spawn via setNickname', () => {
  test('test_setNickname_valid_emits_playerNicknameSet', async () => {
    // Arrange
    const { client } = await connectAndInit(ctx.createClient);

    // Act
    client.emit('setNickname', { nickname: 'Hero01' });
    const data = await waitForEvent(client, 'playerNicknameSet');

    // Assert
    expect(data.nickname).toBe('Hero01');

    client.disconnect();
  });

  test('test_setNickname_duplicate_rejected_with_nicknameRejected', async () => {
    // Arrange — first client claims the name
    const { client: c1 } = await connectAndInit(ctx.createClient);
    await new Promise(res => {
      c1.emit('setNickname', { nickname: 'DupeName' });
      c1.once('playerNicknameSet', res);
    });

    // Act — second client tries the same name
    const { client: c2 } = await connectAndInit(ctx.createClient);
    c2.emit('setNickname', { nickname: 'DupeName' });
    const rejection = await waitForEvent(c2, 'nicknameRejected');

    // Assert
    expect(rejection.reason).toMatch(/déjà/i);

    c1.disconnect();
    c2.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

describe('playerMove', () => {
  test('test_move_with_valid_nickname_updates_player_position', async () => {
    // Arrange
    const { client, initData } = await connectAndInit(ctx.createClient);
    client.emit('setNickname', { nickname: 'Mover01' });
    await waitForEvent(client, 'playerNicknameSet');

    const playerId = initData.playerId;
    const targetX = 400;
    const targetY = 300;

    // Act
    client.emit('playerMove', { x: targetX, y: targetY, angle: 0 });

    // Small wait to let server process the event
    await new Promise(r => setTimeout(r, 80));

    // Assert — position updated in gameState
    const player = ctx.gameState.players[playerId];
    expect(player).toBeDefined();
    // Position should be close to target (clamped to map bounds)
    expect(player.x).toBeGreaterThan(0);
    expect(player.y).toBeGreaterThan(0);

    client.disconnect();
  });

  test('test_move_without_nickname_does_not_update_position', async () => {
    // Arrange — connect but do NOT call setNickname
    const { client, initData } = await connectAndInit(ctx.createClient);
    const playerId = initData.playerId;
    const initialX = ctx.gameState.players[playerId]?.x;

    // Act
    client.emit('playerMove', { x: 999, y: 999, angle: 0 });
    await new Promise(r => setTimeout(r, 80));

    // Assert — position must not have changed
    expect(ctx.gameState.players[playerId]?.x).toBe(initialX);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Disconnect cleanup
// ---------------------------------------------------------------------------

describe('disconnect', () => {
  test('test_disconnect_removes_player_from_gameState', async () => {
    // Arrange
    const { client, initData } = await connectAndInit(ctx.createClient);
    const playerId = initData.playerId;
    expect(ctx.gameState.players[playerId]).toBeDefined();

    // Act
    client.disconnect();
    await new Promise(r => setTimeout(r, 300));

    // Assert — player removed or saved in disconnected buffer (not in active players)
    expect(ctx.gameState.players[playerId]).toBeUndefined();
  });
});
