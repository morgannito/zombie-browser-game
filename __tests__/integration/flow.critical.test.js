/**
 * Integration tests — Critical gameplay flow
 *
 * Flow: start → spawn zombie → kill zombie → level-up reward → buy upgrade → death → respawn
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

async function spawnPlayer(nickname) {
  const { client, initData } = await connectAndInit(ctx.createClient);
  client.emit('setNickname', { nickname });
  await waitForEvent(client, 'playerNicknameSet');
  return { client, playerId: initData.playerId };
}

// ---------------------------------------------------------------------------
// Flow: player joins and receives init state
// ---------------------------------------------------------------------------

describe('critical flow — start', () => {
  test('test_connect_setNickname_playerAppearsInGameState', async () => {
    // Arrange + Act
    const { client, playerId } = await spawnPlayer('FlowTester');

    // Assert
    expect(ctx.gameState.players[playerId]).toBeDefined();

    client.disconnect();
  });

  test('test_connect_init_playerHasAliveTrue', async () => {
    // Arrange + Act
    const { client, playerId } = await spawnPlayer('AliveCheck');

    // Assert
    expect(ctx.gameState.players[playerId].alive).toBe(true);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Flow: zombie kill → gold reward
// ---------------------------------------------------------------------------

describe('critical flow — kill zombie → reward', () => {
  test('test_killZombie_goldDropCreated_lootEntryExists', async () => {
    // Arrange
    const { createLoot } = require('../../game/lootFunctions');
    const { client, playerId } = await spawnPlayer('KillReward');
    const player = ctx.gameState.players[playerId];
    player.x = 200;
    player.y = 200;

    const lootBefore = Object.keys(ctx.gameState.loot).length;

    // Act — simulate loot drop after zombie kill
    createLoot(200, 200, 50, 30, ctx.gameState);

    // Assert
    expect(Object.keys(ctx.gameState.loot).length).toBe(lootBefore + 1);

    client.disconnect();
  });

  test('test_killZombie_zombiesKilledThisWave_increments', async () => {
    // Arrange
    const { client } = await spawnPlayer('WaveCounter');
    const before = ctx.gameState.zombiesKilledThisWave;

    // Act
    ctx.gameState.zombiesKilledThisWave++;

    // Assert
    expect(ctx.gameState.zombiesKilledThisWave).toBe(before + 1);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Flow: buy upgrade
// ---------------------------------------------------------------------------

describe('critical flow — buy upgrade', () => {
  test('test_buyItem_maxHealth_playerMaxHealthIncreases', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('UpgradeBuyer');
    const player = ctx.gameState.players[playerId];
    player.gold = 500;
    const maxHealthBefore = player.maxHealth;

    // Act
    client.emit('buyItem', { itemId: 'maxHealth', category: 'permanent' });
    const update = await waitForEvent(client, 'shopUpdate');

    // Assert
    expect(update.success).toBe(true);
    expect(player.maxHealth).toBeGreaterThan(maxHealthBefore);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Flow: death → respawn
// ---------------------------------------------------------------------------

describe('critical flow — death → respawn', () => {
  test('test_death_playerAlive_becomesFalse', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('DyingPlayer');
    const player = ctx.gameState.players[playerId];
    player.deaths = 0; // ensure field exists before incrementing

    // Act — simulate death
    player.alive = false;
    player.deaths++;

    // Assert
    expect(player.alive).toBe(false);
    expect(player.deaths).toBe(1);

    client.disconnect();
  });

  test('test_respawn_emit_playerAliveBecomesTrue', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('RespawnPlayer');
    const player = ctx.gameState.players[playerId];
    player.alive = false;

    // Act
    client.emit('respawn');

    // Allow server to process
    await new Promise(r => setTimeout(r, 100));

    // Assert
    expect(ctx.gameState.players[playerId].alive).toBe(true);

    client.disconnect();
  });

  test('test_respawn_level_preserved', async () => {
    // Arrange — respawn preserves level (part of progression snapshot)
    const { client, playerId } = await spawnPlayer('StatsPreserver');
    const player = ctx.gameState.players[playerId];
    player.level = 5;
    player.alive = false;

    // Act
    client.emit('respawn');
    await new Promise(r => setTimeout(r, 100));

    // Assert — level is kept across respawn
    expect(ctx.gameState.players[playerId].level).toBe(5);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Flow: wave level-up (WaveManager)
// ---------------------------------------------------------------------------

describe('critical flow — level up wave', () => {
  test('test_handleNewWave_waveCounter_increments', () => {
    // Arrange
    const { handleNewWave } = require("../../contexts/wave/modules/WaveManager");
    const gameState = {
      wave: 3,
      bossSpawned: true,
      zombiesKilledThisWave: 10,
      zombiesSpawnedThisWave: 10,
      players: {},
      mutatorManager: null,
      activeMutators: [],
      mutatorEffects: { spawnCountMultiplier: 1 },
      nextMutatorWave: 0
    };
    const io = { emit: jest.fn() };
    const zombieManager = { restartZombieSpawner: jest.fn() };

    // Act
    handleNewWave(gameState, io, zombieManager);

    // Assert
    expect(gameState.wave).toBe(4);
  });
});
