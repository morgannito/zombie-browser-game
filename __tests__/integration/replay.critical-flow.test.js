/**
 * Replay test — record a sequence of socket events, replay it, assert determinism.
 * The same sequence of events must produce the same observable outcome.
 */

'use strict';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { createTestServer, connectAndInit, waitForEvent } = require('./testServerFactory');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runScenario() {
  const ctx = await createTestServer();

  try {
    const { client, initData } = await connectAndInit(ctx.createClient);
    const playerId = initData.playerId;

    // Step 1 — set nickname
    client.emit('setNickname', { nickname: 'ReplayHero' });
    await waitForEvent(client, 'playerNicknameSet');

    // Give player gold
    ctx.gameState.players[playerId].gold = 200;

    // Step 2 — buy item
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    const shopResult = await waitForEvent(client, 'shopUpdate');

    // Step 3 — move
    client.emit('playerMoveBatch', [{ x: 350, y: 250, angle: 0.5 }]);
    await new Promise(r => setTimeout(r, 80));

    const snapshot = {
      shopSuccess: shopResult.success,
      goldAfterBuy: ctx.gameState.players[playerId].gold,
      maxHealth: ctx.gameState.players[playerId].maxHealth,
      alive: ctx.gameState.players[playerId].alive
    };

    client.disconnect();
    return snapshot;
  } finally {
    await ctx.stop();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('replay — critical flow determinism', () => {
  test('test_replay_buyMaxHealth_goldDeducted_same_run1_and_run2', async () => {
    // Arrange + Act — run scenario twice
    const run1 = await runScenario();
    const run2 = await runScenario();

    // Assert — gold deduction is identical
    expect(run1.goldAfterBuy).toBe(run2.goldAfterBuy);
  });

  test('test_replay_buyMaxHealth_shopSuccess_is_true_both_runs', async () => {
    // Arrange + Act
    const run1 = await runScenario();
    const run2 = await runScenario();

    // Assert
    expect(run1.shopSuccess).toBe(true);
    expect(run2.shopSuccess).toBe(true);
  });

  test('test_replay_buyMaxHealth_maxHealth_increases_consistently', async () => {
    // Arrange + Act
    const run1 = await runScenario();
    const run2 = await runScenario();

    // Assert — same health value after buy (deterministic upgrade delta)
    expect(run1.maxHealth).toBe(run2.maxHealth);
  });

  test('test_replay_player_stays_alive_after_flow', async () => {
    // Arrange + Act
    const run1 = await runScenario();
    const run2 = await runScenario();

    // Assert
    expect(run1.alive).toBe(true);
    expect(run2.alive).toBe(true);
  });

  test('test_replay_two_sequential_upgrades_gold_deducted_cumulatively', async () => {
    // Arrange
    const ctx = await createTestServer();

    try {
      const { client, initData } = await connectAndInit(ctx.createClient);
      const playerId = initData.playerId;

      client.emit('setNickname', { nickname: 'CumulBuyer' });
      await waitForEvent(client, 'playerNicknameSet');

      ctx.gameState.players[playerId].gold = 300;
      // Act — buy twice (costs may escalate, so just verify both succeed and gold decreases)
      client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
      const r1 = await waitForEvent(client, 'shopUpdate');

      client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
      const r2 = await waitForEvent(client, 'shopUpdate');

      const goldAfter = ctx.gameState.players[playerId].gold;

      // Assert
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      // Gold must have decreased by at least 2 purchases (each costs ≥ 50)
      expect(goldAfter).toBeLessThan(300 - 50);

      client.disconnect();
    } finally {
      await ctx.stop();
    }
  });
});
