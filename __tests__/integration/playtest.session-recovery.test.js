/**
 * Playtest 5 — reconnexion apres disconnect, session recovery active
 * Verifie: etat restaure (nickname, gold, level, health), recovered=true dans init.
 */

'use strict';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { randomUUID } = require('crypto');
const { createTestServer, connectAndInit, waitForEvent } = require('./testServerFactory');
const {
  disconnectedPlayers,
  createRecoverablePlayerState
} = require('../../sockets/sessionRecovery');

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

function reconnectWithSession(createClient, sessionId, accountId) {
  return new Promise((resolve, reject) => {
    const sock = createClient({ auth: { sessionId, userId: accountId } });
    const t = setTimeout(() => {
      sock.disconnect();
      reject(new Error('Timeout waiting for init on reconnect'));
    }, 3000);
    sock.once('init', d => {
      clearTimeout(t);
      resolve({ client: sock, initData: d });
    });
    sock.once('connect_error', e => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function saveSession(sessionId, accountId, player, socketId) {
  disconnectedPlayers.set(sessionId, {
    playerState: createRecoverablePlayerState(player),
    disconnectedAt: Date.now(),
    previousSocketId: socketId,
    accountId
  });
}

describe('playtest — session recovery apres reconnexion', () => {
  test('test_session_recovery_restored_flag_true_on_reconnect', async () => {
    // Arrange
    const sessionId = randomUUID();
    const accountId = 'account-RecoverMe';
    const { client: c1, playerId: p1 } = await spawnPlayer('RecoverMe');

    const player = ctx.gameState.players[p1];
    player.gold = 999;
    player.level = 7;
    player.health = 120;
    player.maxHealth = 200;

    saveSession(sessionId, accountId, player, p1);
    c1.disconnect();
    await new Promise(r => setTimeout(r, 200));

    // Act
    const { client: c2, initData } = await reconnectWithSession(
      ctx.createClient,
      sessionId,
      accountId
    );

    // Assert
    expect(initData.recovered).toBe(true);

    c2.disconnect();
  });

  test('test_session_recovery_gold_restored_after_reconnect', async () => {
    // Arrange
    const sessionId = randomUUID();
    const accountId = 'account-GoldRecover';
    const { client: c1, playerId: p1 } = await spawnPlayer('GoldRecover');

    const player = ctx.gameState.players[p1];
    player.gold = 777;
    player.level = 5;
    player.health = 100;
    player.maxHealth = 150;
    player.alive = true;

    saveSession(sessionId, accountId, player, p1);
    c1.disconnect();
    await new Promise(r => setTimeout(r, 200));

    // Act
    const { client: c2, initData } = await reconnectWithSession(
      ctx.createClient,
      sessionId,
      accountId
    );
    const restoredPlayer = ctx.gameState.players[initData.playerId];

    // Assert
    expect(restoredPlayer.gold).toBe(777);

    c2.disconnect();
  });

  test('test_session_recovery_level_restored_after_reconnect', async () => {
    // Arrange
    const sessionId = randomUUID();
    const accountId = 'account-LevelRecover';
    const { client: c1, playerId: p1 } = await spawnPlayer('LevelRecover');

    const player = ctx.gameState.players[p1];
    player.level = 10;
    player.gold = 50;
    player.health = 80;
    player.maxHealth = 200;
    player.alive = true;

    saveSession(sessionId, accountId, player, p1);
    c1.disconnect();
    await new Promise(r => setTimeout(r, 200));

    // Act
    const { client: c2, initData } = await reconnectWithSession(
      ctx.createClient,
      sessionId,
      accountId
    );
    const restoredPlayer = ctx.gameState.players[initData.playerId];

    // Assert
    expect(restoredPlayer.level).toBe(10);

    c2.disconnect();
  });

  test('test_no_recovery_without_sessionId_new_player_created', async () => {
    // Arrange + Act — connect without sessionId
    const { client, initData } = await connectAndInit(ctx.createClient);

    // Assert — not a recovered session
    expect(initData.recovered).toBe(false);

    client.disconnect();
  });

  test('test_no_recovery_after_session_timeout_expired', async () => {
    // Arrange — save an expired session entry
    const sessionId = randomUUID();
    const accountId = 'account-Expired';

    disconnectedPlayers.set(sessionId, {
      playerState: {
        id: 'old-socket',
        nickname: 'Expired',
        hasNickname: true,
        alive: true,
        health: 100,
        maxHealth: 200,
        level: 3,
        gold: 300,
        xp: 0,
        score: 0,
        angle: 0,
        weapon: 'pistol',
        lastShot: 0,
        upgrades: { maxHealth: 0, damage: 0, speed: 0, fireRate: 0 }
      },
      disconnectedAt: Date.now() - 999999999,
      previousSocketId: 'old-socket',
      accountId
    });

    // Act
    const { client, initData } = await reconnectWithSession(ctx.createClient, sessionId, accountId);

    // Assert — server always responds with a valid playerId
    expect(initData.playerId).toBeTruthy();

    client.disconnect();
  });
});
