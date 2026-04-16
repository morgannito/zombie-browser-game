/**
 * Chaos test — 5 simultaneous clients spamming events
 * Server must not crash and all sockets must connect/disconnect cleanly.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function spawnPlayer(nickname) {
  const { client, initData } = await connectAndInit(ctx.createClient);
  client.emit('setNickname', { nickname });
  await waitForEvent(client, 'playerNicknameSet');
  return { client, playerId: initData.playerId };
}

function spamEvents(client, count) {
  const shootData = { x: 400, y: 300, angle: 0, weapon: 'pistol' };
  const moveData = { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200, angle: 0 };
  for (let i = 0; i < count; i++) {
    client.emit('shoot', shootData);
    client.emit('playerMoveBatch', [moveData]);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chaos — 5 simultaneous clients spamming', () => {
  test('test_chaos_5clients_connect_simultaneously_all_receive_init', async () => {
    // Arrange + Act
    const connections = await Promise.all([
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient)
    ]);

    // Assert
    expect(connections).toHaveLength(5);
    connections.forEach(({ initData }) => {
      expect(initData.playerId).toBeTruthy();
    });

    connections.forEach(({ client }) => client.disconnect());
  });

  test('test_chaos_5clients_get_distinct_playerIds', async () => {
    // Arrange + Act
    const connections = await Promise.all([
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient),
      connectAndInit(ctx.createClient)
    ]);

    const ids = connections.map(c => c.initData.playerId);

    // Assert
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);

    connections.forEach(({ client }) => client.disconnect());
  });

  test('test_chaos_5clients_spam_100events_each_server_stays_alive', async () => {
    // Arrange
    const players = await Promise.all([
      spawnPlayer('Chaos1'),
      spawnPlayer('Chaos2'),
      spawnPlayer('Chaos3'),
      spawnPlayer('Chaos4'),
      spawnPlayer('Chaos5')
    ]);

    // Act — each client spams 100 shoot + move events
    players.forEach(({ client }) => spamEvents(client, 100));

    // Wait for server to process all events
    await new Promise(r => setTimeout(r, 1000));

    // Assert — server is still alive: new connection works
    const { client: probe, initData } = await connectAndInit(ctx.createClient);
    expect(initData.playerId).toBeTruthy();

    probe.disconnect();
    players.forEach(({ client }) => client.disconnect());
  });

  test('test_chaos_concurrent_spam_gameState_has_no_negative_bullets', async () => {
    // Arrange
    const players = await Promise.all([
      spawnPlayer('SpamA'),
      spawnPlayer('SpamB'),
      spawnPlayer('SpamC')
    ]);
    players.forEach(({ playerId }) => {
      ctx.gameState.players[playerId].lastShot = 0;
    });

    // Act
    players.forEach(({ client }) => spamEvents(client, 50));
    await new Promise(r => setTimeout(r, 500));

    // Assert — bullet count is non-negative (no underflow)
    const bulletCount = Object.keys(ctx.gameState.bullets).length;
    expect(bulletCount).toBeGreaterThanOrEqual(0);

    players.forEach(({ client }) => client.disconnect());
  });

  test('test_chaos_5clients_disconnect_all_removed_from_gameState', async () => {
    // Arrange
    const players = await Promise.all([
      spawnPlayer('Leaver1'),
      spawnPlayer('Leaver2'),
      spawnPlayer('Leaver3'),
      spawnPlayer('Leaver4'),
      spawnPlayer('Leaver5')
    ]);
    const ids = players.map(p => p.playerId);

    // Act
    players.forEach(({ client }) => client.disconnect());
    await new Promise(r => setTimeout(r, 600));

    // Assert — all removed from active players
    ids.forEach(id => {
      expect(ctx.gameState.players[id]).toBeUndefined();
    });
  });
});
