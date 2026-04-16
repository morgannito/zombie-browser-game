/**
 * Playtest 4 — joueur achete upgrade valide, stats changent
 * Verifie: gold debite, effet applique, shopUpdate success emis.
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

describe('playtest — achat upgrade valide', () => {
  test('test_buyItem_maxHealth_valid_gold_deducted_and_success_emitted', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('Buyer01');
    const player = ctx.gameState.players[playerId];
    player.gold = 200;

    // Act
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    const result = await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(result.success).toBe(true);
    expect(player.gold).toBeLessThan(200);

    client.disconnect();
  });

  test('test_buyItem_maxHealth_increases_player_maxHealth_stat', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('Buyer02');
    const player = ctx.gameState.players[playerId];
    player.gold = 500;
    const healthBefore = player.maxHealth;

    // Act
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(player.maxHealth).toBeGreaterThan(healthBefore);

    client.disconnect();
  });

  test('test_buyItem_fireRate_valid_purchase_emits_success', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('Buyer03');
    const player = ctx.gameState.players[playerId];
    player.gold = 500;

    // Act
    client.emit('buyItem', { itemId: 'fireRate', category: 'permanent' });
    const result = await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(result.success).toBe(true);

    client.disconnect();
  });

  test('test_buyItem_zero_gold_rejected_gold_unchanged', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('Buyer04');
    const player = ctx.gameState.players[playerId];
    player.gold = 0;

    // Act
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    const result = await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(result.success).toBe(false);
    expect(player.gold).toBe(0);

    client.disconnect();
  });

  test('test_selectUpgrade_healthBoost_increases_maxHealth', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('Upgrader01');
    const player = ctx.gameState.players[playerId];
    player.pendingUpgradeChoices = [['healthBoost', 'damageBoost', 'speedBoost']];
    const healthBefore = player.maxHealth;

    // Act
    client.emit('selectUpgrade', { upgradeId: 'healthBoost' });
    const result = await waitForEvent(client, 'upgradeSelected');

    // Assert
    expect(result.success).toBe(true);
    expect(player.maxHealth).toBeGreaterThan(healthBefore);

    client.disconnect();
  });
});
