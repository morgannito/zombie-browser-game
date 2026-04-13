/**
 * Integration tests — Socket.IO gameplay mechanics
 *
 * Flows covered:
 *  1. Shop buyItem — sufficient gold → success
 *  2. Shop buyItem — insufficient gold → rejected (TOCTOU fix)
 *  3. Rate limit shoot — 21 shots in 1 s → 21st blocked
 *  4. selectUpgrade — upgradeId not in pendingChoices → silently rejected
 *  5. selectUpgrade — valid upgradeId from pendingChoices → success
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
// Helper: spawn a fully-ready player (connected + nickname set)
// ---------------------------------------------------------------------------
async function spawnPlayer(nickname) {
  const { client, initData } = await connectAndInit(ctx.createClient);
  client.emit('setNickname', { nickname });
  await waitForEvent(client, 'playerNicknameSet');
  return { client, playerId: initData.playerId };
}

// ---------------------------------------------------------------------------
// Shop — buyItem
// ---------------------------------------------------------------------------

describe('shop buyItem', () => {
  test('test_buyItem_sufficient_gold_emits_shopUpdate_success', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('ShopHero');
    const player = ctx.gameState.players[playerId];
    player.gold = 200; // more than baseCost=50 for maxHealth

    // Act
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    const update = await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(update.success).toBe(true);
    expect(update.itemId).toBe('maxHealth');
    expect(player.gold).toBe(150); // 200 - 50

    client.disconnect();
  });

  test('test_buyItem_insufficient_gold_emits_shopUpdate_failure', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('BrokeBob');
    const player = ctx.gameState.players[playerId];
    player.gold = 10; // less than baseCost=50

    // Act
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    const update = await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(update.success).toBe(false);
    expect(update.message).toMatch(/insuffisant/i);
    expect(player.gold).toBe(10); // gold unchanged — TOCTOU fix verified

    client.disconnect();
  });

  test('test_buyItem_toctou_gold_not_double_spent_on_concurrent_requests', async () => {
    // Arrange — only enough gold for exactly one purchase
    const { client, playerId } = await spawnPlayer('ToctooBuyer');
    const player = ctx.gameState.players[playerId];
    player.gold = 50; // exactly one maxHealth upgrade (cost 50)

    // Act — fire two buyItem simultaneously
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });

    const results = await new Promise(resolve => {
      const collected = [];
      const handler = data => {
        collected.push(data);
        if (collected.length === 2) {
          client.off('shopUpdate', handler);
          resolve(collected);
        }
      };
      client.on('shopUpdate', handler);
      setTimeout(() => resolve(collected), 1500); // fallback
    });

    // Assert — exactly one success and one failure (gold can't go negative)
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1);
    expect(player.gold).toBeGreaterThanOrEqual(0);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Rate limit — shoot
// ---------------------------------------------------------------------------

describe('shoot rate limit', () => {
  test('test_shoot_21_times_in_1s_21st_is_blocked_by_rateLimit', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('GunnerX');
    const player = ctx.gameState.players[playerId];
    // Give player no weapon cooldown constraint — set lastShot far in the past
    player.lastShot = 0;

    const bulletsBefore = Object.keys(ctx.gameState.bullets).length;

    // Act — emit 21 shoot events as fast as possible
    // maxRequests = 20, windowMs = 1000
    const shootData = { x: 400, y: 300, angle: 0, weapon: 'pistol' };
    for (let i = 0; i < 21; i++) {
      // Reset weapon cooldown so each shot isn't blocked by fire-rate
      player.lastShot = 0;
      client.emit('shoot', shootData);
    }

    // Wait for server to process all emitted events
    await new Promise(r => setTimeout(r, 200));

    // Assert — at most 20 bullets were created (21st was rate-limited)
    const bulletsAfter = Object.keys(ctx.gameState.bullets).length;
    const created = bulletsAfter - bulletsBefore;
    expect(created).toBeLessThanOrEqual(20);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// selectUpgrade
// ---------------------------------------------------------------------------

describe('selectUpgrade', () => {
  test('test_selectUpgrade_upgradeId_not_in_pendingChoices_is_silently_rejected', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('UpgradeCheat');
    const player = ctx.gameState.players[playerId];
    // pendingUpgradeChoices is empty by default — inject a different valid id
    player.pendingUpgradeChoices = ['damageBoost'];

    // Act — send an id NOT in the pending choices
    client.emit('selectUpgrade', { upgradeId: 'speedBoost' });

    // Wait briefly; no 'upgradeSelected' event should arrive
    const result = await Promise.race([
      waitForEvent(client, 'upgradeSelected', 500)
        .then(() => 'received')
        .catch(() => 'not_received'),
      new Promise(r => setTimeout(() => r('not_received'), 600))
    ]);

    // Assert
    expect(result).toBe('not_received');
    // pendingChoices untouched — server consumed nothing
    expect(player.pendingUpgradeChoices).toEqual(['damageBoost']);

    client.disconnect();
  });

  test('test_selectUpgrade_valid_id_in_pendingChoices_emits_upgradeSelected_success', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('UpgraderLegit');
    const player = ctx.gameState.players[playerId];
    player.pendingUpgradeChoices = ['healthBoost', 'damageBoost', 'speedBoost'];
    const initialHealth = player.maxHealth;

    // Act
    client.emit('selectUpgrade', { upgradeId: 'healthBoost' });
    const result = await waitForEvent(client, 'upgradeSelected');

    // Assert
    expect(result.success).toBe(true);
    expect(result.upgradeId).toBe('healthBoost');
    // pendingChoices consumed
    expect(player.pendingUpgradeChoices).toEqual([]);
    // Effect applied — healthBoost increases maxHealth
    expect(player.maxHealth).toBeGreaterThan(initialHealth);

    client.disconnect();
  });
});
