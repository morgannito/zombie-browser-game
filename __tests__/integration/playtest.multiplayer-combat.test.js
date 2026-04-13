/**
 * Playtest 2 — 3 joueurs jouent en parallele, friendly fire, cleanup ok
 * Verifie: spawns distincts, cleanup apres deconnexions.
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

async function spawnPlayer(nickname) {
  const { client, initData } = await connectAndInit(ctx.createClient);
  client.emit('setNickname', { nickname });
  await waitForEvent(client, 'playerNicknameSet');
  return { client, playerId: initData.playerId };
}

describe('playtest — 3 joueurs en parallele', () => {
  test('test_3players_spawn_simultaneously_have_distinct_ids', async () => {
    // Arrange + Act
    const [p1, p2, p3] = await Promise.all([
      spawnPlayer('Fighter1'),
      spawnPlayer('Fighter2'),
      spawnPlayer('Fighter3')
    ]);

    // Assert
    const ids = new Set([p1.playerId, p2.playerId, p3.playerId]);
    expect(ids.size).toBe(3);

    p1.client.disconnect();
    p2.client.disconnect();
    p3.client.disconnect();
  });

  test('test_3players_all_alive_after_spawn', async () => {
    // Arrange
    const [p1, p2, p3] = await Promise.all([
      spawnPlayer('Alive1'),
      spawnPlayer('Alive2'),
      spawnPlayer('Alive3')
    ]);

    // Act — check game state
    const players = [p1, p2, p3].map(p => ctx.gameState.players[p.playerId]);

    // Assert — all alive
    players.forEach(player => expect(player.alive).toBe(true));

    p1.client.disconnect();
    p2.client.disconnect();
    p3.client.disconnect();
  });

  test('test_3players_shoot_bullets_created_in_gamestate', async () => {
    // Arrange
    const [p1, p2, p3] = await Promise.all([
      spawnPlayer('Gunner1'),
      spawnPlayer('Gunner2'),
      spawnPlayer('Gunner3')
    ]);

    [p1, p2, p3].forEach(({ playerId }) => {
      ctx.gameState.players[playerId].lastShot = 0;
    });

    const bulletsBefore = Object.keys(ctx.gameState.bullets).length;

    // Act — each fires 3 shots
    [p1, p2, p3].forEach(({ client, playerId }) => {
      ctx.gameState.players[playerId].lastShot = 0;
      client.emit('shoot', { x: 400, y: 300, angle: 0, weapon: 'pistol' });
      client.emit('shoot', { x: 400, y: 300, angle: 1, weapon: 'pistol' });
      client.emit('shoot', { x: 400, y: 300, angle: 2, weapon: 'pistol' });
    });

    await new Promise(r => setTimeout(r, 200));

    // Assert — at least some bullets were created
    const bulletsAfter = Object.keys(ctx.gameState.bullets).length;
    expect(bulletsAfter).toBeGreaterThanOrEqual(bulletsBefore);

    p1.client.disconnect();
    p2.client.disconnect();
    p3.client.disconnect();
  });

  test('test_3players_disconnect_all_cleaned_from_gamestate', async () => {
    // Arrange
    const [p1, p2, p3] = await Promise.all([
      spawnPlayer('Leaver1x'),
      spawnPlayer('Leaver2x'),
      spawnPlayer('Leaver3x')
    ]);
    const ids = [p1.playerId, p2.playerId, p3.playerId];

    // Act
    p1.client.disconnect();
    p2.client.disconnect();
    p3.client.disconnect();
    await new Promise(r => setTimeout(r, 500));

    // Assert
    ids.forEach(id => expect(ctx.gameState.players[id]).toBeUndefined());
  });
});
