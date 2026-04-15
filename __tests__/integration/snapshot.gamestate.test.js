/**
 * Snapshot test — game state after N deterministic ticks.
 * Two fresh game states run through the same tick count must produce
 * structurally equivalent snapshots.
 */

'use strict';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32chars-xx';
process.env.DB_PATH = ':memory:';
process.env.REQUIRE_DATABASE = 'false';

const { initializeGameState } = require('../../game/gameState');
const { initializeRooms } = require('../../game/roomFunctions');
const { gameLoop } = require('../../game/gameLoop');
const ConfigManager = require('../../lib/server/ConfigManager');
const CollisionManager = require('../../contexts/weapons/CollisionManager');
const EntityManager = require('../../lib/server/EntityManager');
const ZombieManager = require('../../contexts/zombie/ZombieManager');
const MetricsCollector = require('../../lib/infrastructure/MetricsCollector');
const perfIntegration = require('../../lib/server/PerformanceIntegration');

const { CONFIG } = ConfigManager;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function buildDeps() {
  const gameState = initializeGameState();
  initializeRooms(gameState, CONFIG);
  gameState.currentRoom = 0;

  const io = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis()
  };

  const collisionManager = new CollisionManager(gameState, CONFIG);
  collisionManager.rebuildQuadtree = jest.fn();

  const entityManager = new EntityManager(gameState, CONFIG);
  entityManager.cleanupExpiredEntities = jest.fn();

  const zombieTypes = ConfigManager.ZOMBIE_TYPES || {};
  const zombieManager = new ZombieManager(gameState, CONFIG, zombieTypes, () => false, io);
  zombieManager.restartZombieSpawner = jest.fn();

  const metricsCollector = MetricsCollector.getInstance
    ? MetricsCollector.getInstance()
    : new MetricsCollector();

  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return {
    gameState,
    io,
    collisionManager,
    entityManager,
    zombieManager,
    metricsCollector,
    logger
  };
}

function runTicks(deps, n) {
  const {
    gameState,
    io,
    collisionManager,
    entityManager,
    zombieManager,
    metricsCollector,
    logger
  } = deps;
  for (let i = 0; i < n; i++) {
    gameLoop(
      gameState,
      io,
      metricsCollector,
      perfIntegration,
      collisionManager,
      entityManager,
      zombieManager,
      logger
    );
  }
}

function takeSnapshot(gameState) {
  return {
    wave: gameState.wave,
    bossSpawned: gameState.bossSpawned,
    bulletCount: Object.keys(gameState.bullets).length,
    zombieCount: Object.keys(gameState.zombies).length,
    powerupCount: Object.keys(gameState.powerups).length,
    particleCount: Object.keys(gameState.particles).length,
    hasDeltaMultiplier: typeof gameState._deltaMultiplier === 'number',
    currentRoom: gameState.currentRoom
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('snapshot — game state after N deterministic ticks', () => {
  test('test_snapshot_after_10ticks_wave_is_1', () => {
    // Arrange
    const deps = buildDeps();

    // Act
    runTicks(deps, 10);
    const snap = takeSnapshot(deps.gameState);

    // Assert — no player connected, wave stays at 1
    expect(snap.wave).toBe(1);
  });

  test('test_snapshot_after_10ticks_bulletCount_is_zero_no_players', () => {
    // Arrange
    const deps = buildDeps();

    // Act
    runTicks(deps, 10);
    const snap = takeSnapshot(deps.gameState);

    // Assert — no players => no bullets spawned
    expect(snap.bulletCount).toBe(0);
  });

  test('test_snapshot_after_10ticks_deltaMultiplier_is_present', () => {
    // Arrange
    const deps = buildDeps();

    // Act
    runTicks(deps, 10);
    const snap = takeSnapshot(deps.gameState);

    // Assert
    expect(snap.hasDeltaMultiplier).toBe(true);
  });

  test('test_snapshot_two_identical_runs_produce_same_wave', () => {
    // Arrange
    const deps1 = buildDeps();
    const deps2 = buildDeps();

    // Act
    runTicks(deps1, 50);
    runTicks(deps2, 50);

    const snap1 = takeSnapshot(deps1.gameState);
    const snap2 = takeSnapshot(deps2.gameState);

    // Assert — wave number is identical (no random progression without players)
    expect(snap1.wave).toBe(snap2.wave);
  });

  test('test_snapshot_two_identical_runs_produce_same_currentRoom', () => {
    // Arrange
    const deps1 = buildDeps();
    const deps2 = buildDeps();

    // Act
    runTicks(deps1, 50);
    runTicks(deps2, 50);

    const snap1 = takeSnapshot(deps1.gameState);
    const snap2 = takeSnapshot(deps2.gameState);

    // Assert
    expect(snap1.currentRoom).toBe(snap2.currentRoom);
  });

  test('test_snapshot_after_100ticks_bossSpawned_is_false_no_players', () => {
    // Arrange
    const deps = buildDeps();

    // Act
    runTicks(deps, 100);
    const snap = takeSnapshot(deps.gameState);

    // Assert — no players means no boss condition met
    expect(snap.bossSpawned).toBe(false);
  });
});
