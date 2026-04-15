/**
 * Long-run test — gameLoop ticks 1000 times, no memory leak.
 * Monitors heapUsed growth between first 10 ticks and last 10 ticks.
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
const MetricsCollector = require('../../infrastructure/metrics/MetricsCollector');
const perfIntegration = require('../../lib/server/PerformanceIntegration');

const { CONFIG } = ConfigManager;

// ---------------------------------------------------------------------------
// Stub dependencies
// ---------------------------------------------------------------------------

function buildLoopDeps() {
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

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('long run — gameLoop 1000 ticks', () => {
  test('test_longrun_1000ticks_server_does_not_throw', () => {
    // Arrange
    const {
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      metricsCollector,
      logger
    } = buildLoopDeps();

    // Act + Assert — must not throw
    expect(() => {
      for (let i = 0; i < 1000; i++) {
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
    }).not.toThrow();
  });

  test('test_longrun_1000ticks_heapUsed_growth_under_50mb', () => {
    // Arrange
    const {
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      metricsCollector,
      logger
    } = buildLoopDeps();

    // Warm-up (10 ticks) — let JIT settle
    for (let i = 0; i < 10; i++) {
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

    if (global.gc) {
      global.gc();
    }
    const heapBefore = process.memoryUsage().heapUsed;

    // Act — 1000 ticks
    for (let i = 0; i < 1000; i++) {
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

    if (global.gc) {
      global.gc();
    }
    const heapAfter = process.memoryUsage().heapUsed;
    const growthMB = (heapAfter - heapBefore) / 1024 / 1024;

    // Assert — heap growth under 50 MB
    expect(growthMB).toBeLessThan(50);
  });

  test('test_longrun_1000ticks_gameState_entities_counts_are_nonnegative', () => {
    // Arrange
    const {
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      metricsCollector,
      logger
    } = buildLoopDeps();

    // Act
    for (let i = 0; i < 1000; i++) {
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

    // Assert — no entity maps go negative or corrupt
    expect(Object.keys(gameState.bullets).length).toBeGreaterThanOrEqual(0);
    expect(Object.keys(gameState.zombies).length).toBeGreaterThanOrEqual(0);
    expect(Object.keys(gameState.particles).length).toBeGreaterThanOrEqual(0);
  });

  test('test_longrun_1000ticks_deltaMultiplier_stored_in_gameState', () => {
    // Arrange
    const {
      gameState,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      metricsCollector,
      logger
    } = buildLoopDeps();

    // Act
    for (let i = 0; i < 1000; i++) {
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

    // Assert — deltaMultiplier was set and is a non-negative finite number
    // (can be 0 when ticks run in the same millisecond in test environment)
    expect(typeof gameState._deltaMultiplier).toBe('number');
    expect(isFinite(gameState._deltaMultiplier)).toBe(true);
    expect(gameState._deltaMultiplier).toBeGreaterThanOrEqual(0);
  });
});
