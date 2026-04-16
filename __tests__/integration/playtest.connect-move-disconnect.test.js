/**
 * Playtest 1 — joueur connecte, spawn, bouge 10s, deconnecte
 * Verifie: pas d'erreur serveur, nettoyage propre.
 */

'use strict';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { createTestServer, connectAndInit, waitForEvent } = require('./testServerFactory');

let ctx;

beforeAll(async () => {
  ctx = await createTestServer();
}, 15000);

afterAll(async () => {
  await ctx.stop();
}, 10000);

describe('playtest — connect, spawn, move, disconnect', () => {
  test('test_player_connect_spawn_move_10s_disconnect_no_server_error', async () => {
    // Arrange
    const { client, initData } = await connectAndInit(ctx.createClient);
    const playerId = initData.playerId;

    client.emit('setNickname', { nickname: 'PlaytestMover' });
    await waitForEvent(client, 'playerNicknameSet');

    const player = ctx.gameState.players[playerId];
    expect(player).toBeDefined();

    // Act — simulate movement over ~10 ticks (not literally 10s to keep test fast)
    const positions = [
      { x: 350, y: 300 },
      { x: 360, y: 310 },
      { x: 370, y: 320 },
      { x: 380, y: 330 },
      { x: 390, y: 340 },
      { x: 400, y: 350 },
      { x: 410, y: 360 },
      { x: 420, y: 370 },
      { x: 430, y: 380 },
      { x: 440, y: 390 }
    ];

    for (const pos of positions) {
      client.emit('playerMoveBatch', [{ x: pos.x, y: pos.y, angle: 0 }]);
      await new Promise(r => setTimeout(r, 50));
    }

    // Disconnect
    client.disconnect();
    await new Promise(r => setTimeout(r, 300));

    // Assert — player removed from active state
    expect(ctx.gameState.players[playerId]).toBeUndefined();
  });

  test('test_player_alive_after_spawn_before_disconnect', async () => {
    // Arrange
    const { client, initData } = await connectAndInit(ctx.createClient);
    const playerId = initData.playerId;

    // Act
    client.emit('setNickname', { nickname: 'AliveCheck' });
    await waitForEvent(client, 'playerNicknameSet');

    // Assert
    expect(ctx.gameState.players[playerId].alive).toBe(true);

    client.disconnect();
  });

  test('test_player_receives_gameState_on_connect', async () => {
    // Arrange + Act
    const gameStateReceived = await new Promise((resolve, reject) => {
      const client = ctx.createClient();
      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error('Timeout waiting for gameState'));
      }, 3000);

      client.once('gameState', data => {
        clearTimeout(timeout);
        client.disconnect();
        resolve(data);
      });
      client.once('connect_error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Assert
    expect(gameStateReceived).toBeDefined();
    expect(gameStateReceived.full).toBe(true);
  });
});
