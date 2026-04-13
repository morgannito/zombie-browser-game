/**
 * Playtest 3 — joueur monte jusqu'a wave 3 via kills zombies, recoit rewards
 * Verifie: newWave emis, survivors recompenses (gold+50, health+50).
 */

'use strict';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { createTestServer, connectAndInit, waitForEvent } = require('./testServerFactory');
const { handleNewWave } = require('../../game/modules/wave/WaveManager');

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

describe('playtest — wave progression via boss kill', () => {
  test('test_wave_increment_when_handleNewWave_called', async () => {
    // Arrange
    const waveBefore = ctx.gameState.wave;
    const zombieManager = { restartZombieSpawner: jest.fn() };

    // Act
    handleNewWave(ctx.gameState, ctx.io, zombieManager);

    // Assert
    expect(ctx.gameState.wave).toBe(waveBefore + 1);

    // Cleanup
    ctx.gameState.wave = waveBefore;
  });

  test('test_wave_progression_survivors_receive_gold_reward', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('WaveSurvivor');
    const player = ctx.gameState.players[playerId];
    player.gold = 100;
    player.health = 80;
    player.maxHealth = 200;

    const zombieManager = { restartZombieSpawner: jest.fn() };

    // Act — simulate boss kill triggering new wave
    handleNewWave(ctx.gameState, ctx.io, zombieManager);

    // Assert — survivor gets +50 gold and +50 health (capped at maxHealth)
    expect(player.gold).toBe(150);
    expect(player.health).toBe(130);

    client.disconnect();
    ctx.gameState.wave = 1;
  });

  test('test_wave_progression_health_capped_at_maxHealth', async () => {
    // Arrange
    const { client, playerId } = await spawnPlayer('NearFullHp');
    const player = ctx.gameState.players[playerId];
    player.health = 190;
    player.maxHealth = 200;

    const zombieManager = { restartZombieSpawner: jest.fn() };

    // Act
    handleNewWave(ctx.gameState, ctx.io, zombieManager);

    // Assert — health capped at maxHealth (200), not 240
    expect(player.health).toBeLessThanOrEqual(player.maxHealth);

    client.disconnect();
    ctx.gameState.wave = 1;
  });

  test('test_wave_3_reached_after_two_boss_kills', async () => {
    // Arrange
    ctx.gameState.wave = 1;
    const { client, playerId } = await spawnPlayer('WaveClimber');
    const player = ctx.gameState.players[playerId];
    player.gold = 0;

    const zombieManager = { restartZombieSpawner: jest.fn() };

    // Act — two wave transitions
    handleNewWave(ctx.gameState, ctx.io, zombieManager);
    handleNewWave(ctx.gameState, ctx.io, zombieManager);

    // Assert
    expect(ctx.gameState.wave).toBe(3);
    expect(player.gold).toBe(100); // 2 × 50 wave reward

    client.disconnect();
    ctx.gameState.wave = 1;
  });

  test('test_newWave_emitted_to_clients_on_wave_transition', async () => {
    // Arrange
    const { client } = await spawnPlayer('WaveListener');
    ctx.gameState.wave = 4;

    const zombieManager = { restartZombieSpawner: jest.fn() };

    // Act
    const newWavePromise = waitForEvent(client, 'newWave', 3000);
    handleNewWave(ctx.gameState, ctx.io, zombieManager);
    const waveData = await newWavePromise;

    // Assert
    expect(waveData.wave).toBe(5);

    client.disconnect();
    ctx.gameState.wave = 1;
  });
});
