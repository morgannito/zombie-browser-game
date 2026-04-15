/**
 * Unit tests for contexts/player/modules/DeathProgressionHandler.js
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  GAMEPLAY_CONSTANTS: {
    SURVIVAL_TIME_MULTIPLIER: 1000,
    FAILED_DEATH_QUEUE_MAX_SIZE: 3
  }
}));

const {
  handlePlayerDeathProgression,
  processFailedDeathQueue,
  cleanupOrphanedTrackingData
} = require('../DeathProgressionHandler');

function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  };
}

describe('handlePlayerDeathProgression', () => {
  test('returns false on invalid player', () => {
    const logger = makeLogger();
    expect(handlePlayerDeathProgression(null, 'p1', {}, 1000, false, logger)).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  test('returns false when health > 0', () => {
    const player = { alive: true, health: 50 };
    expect(handlePlayerDeathProgression(player, 'p1', {}, 1000)).toBe(false);
  });

  test('returns false if player already dead', () => {
    const player = { alive: false, health: -10 };
    expect(handlePlayerDeathProgression(player, 'p1', {}, 1000)).toBe(false);
    expect(player.health).toBe(0);
  });

  test('clamps non-number health to 0 with warning', () => {
    const player = { alive: true, health: 'bad' };
    const logger = makeLogger();
    handlePlayerDeathProgression(player, 'p1', {}, 1000, false, logger);
    expect(logger.warn).toHaveBeenCalled();
    expect(player.health).toBe(0);
  });

  test('revives player via second chance', () => {
    const player = { alive: true, health: 0 };
    const gameState = {
      progressionIntegration: { checkSecondChance: jest.fn(() => true) }
    };
    const result = handlePlayerDeathProgression(player, 'p1', gameState, 1000);
    expect(result).toBe(true);
    expect(player.alive).toBe(true); // not marked dead
  });

  test('marks dead when second chance fails', () => {
    const player = { alive: true, health: 0, accountId: 'acc1', survivalTime: 500 };
    const gameState = {
      wave: 3,
      progressionIntegration: {
        checkSecondChance: () => false,
        handlePlayerDeath: jest.fn(() => ({ catch: () => {} }))
      }
    };
    const result = handlePlayerDeathProgression(player, 'p1', gameState, 2000);
    expect(result).toBeFalsy();
    expect(player.alive).toBe(false);
    expect(gameState.progressionIntegration.handlePlayerDeath).toHaveBeenCalled();
  });

  test('skips save when no accountId', () => {
    const player = { alive: true, health: 0 };
    const gameState = {
      progressionIntegration: {
        checkSecondChance: () => false,
        handlePlayerDeath: jest.fn()
      }
    };
    handlePlayerDeathProgression(player, 'p1', gameState, 1000);
    expect(gameState.progressionIntegration.handlePlayerDeath).not.toHaveBeenCalled();
    expect(player.alive).toBe(false);
  });
});

describe('processFailedDeathQueue', () => {
  test('no-op on empty queue', () => {
    const gameState = { failedDeathQueue: [] };
    expect(() => processFailedDeathQueue(gameState, makeLogger())).not.toThrow();
  });

  test('no-op when queue undefined', () => {
    expect(() => processFailedDeathQueue({}, makeLogger())).not.toThrow();
  });

  test('abandons entry past MAX_RETRIES', () => {
    const logger = makeLogger();
    const gameState = {
      failedDeathQueue: [{
        player: { id: 'p1' }, accountId: 'a1', stats: {},
        retryCount: 3, lastRetry: 0, timestamp: 0
      }],
      progressionIntegration: { handlePlayerDeath: jest.fn() }
    };
    processFailedDeathQueue(gameState, logger);
    expect(gameState.failedDeathQueue).toHaveLength(0);
    expect(logger.error).toHaveBeenCalled();
  });

  test('skips entry within retry interval', () => {
    const now = Date.now();
    const gameState = {
      failedDeathQueue: [{
        player: { id: 'p1' }, accountId: 'a1', stats: {},
        retryCount: 1, lastRetry: now - 5000, timestamp: 0
      }],
      progressionIntegration: { handlePlayerDeath: jest.fn() }
    };
    processFailedDeathQueue(gameState, makeLogger());
    expect(gameState.progressionIntegration.handlePlayerDeath).not.toHaveBeenCalled();
    expect(gameState.failedDeathQueue).toHaveLength(1);
  });

  test('drops entry missing accountId', () => {
    const logger = makeLogger();
    const gameState = {
      failedDeathQueue: [{
        player: { id: 'p1' }, accountId: null, stats: {},
        retryCount: 0, timestamp: 0
      }],
      progressionIntegration: { handlePlayerDeath: jest.fn() }
    };
    processFailedDeathQueue(gameState, logger);
    expect(gameState.failedDeathQueue).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('triggers retry when interval elapsed', () => {
    const fakePromise = { then: jest.fn(() => fakePromise), catch: jest.fn(() => fakePromise) };
    const gameState = {
      failedDeathQueue: [{
        player: { id: 'p1' }, accountId: 'a1', stats: { wave: 1 },
        retryCount: 0, lastRetry: 0, timestamp: 0
      }],
      progressionIntegration: { handlePlayerDeath: jest.fn(() => fakePromise) }
    };
    processFailedDeathQueue(gameState, makeLogger());
    expect(gameState.progressionIntegration.handlePlayerDeath).toHaveBeenCalled();
    expect(gameState.failedDeathQueue[0].retryCount).toBe(1);
  });
});

describe('cleanupOrphanedTrackingData', () => {
  test('skips if last cleanup < 1s ago', () => {
    const gameState = {
      _lastTrackingCleanup: 100,
      players: {},
      zombies: {}
    };
    cleanupOrphanedTrackingData(gameState, 500);
    expect(gameState._lastTrackingCleanup).toBe(100); // unchanged
  });

  test('bootstraps _lastTrackingCleanup on first call', () => {
    const gameState = { players: {}, zombies: {} };
    cleanupOrphanedTrackingData(gameState, 1000);
    expect(gameState._lastTrackingCleanup).toBe(1000);
  });

  test('removes orphaned zombie damage entries', () => {
    const player = {
      lastDamageTime: { z1: 100, zGone: 200 }
    };
    const gameState = {
      _lastTrackingCleanup: 500,
      players: { p1: player },
      zombies: { z1: {} },
      poisonTrails: {}
    };
    cleanupOrphanedTrackingData(gameState, 2000);
    expect(player.lastDamageTime.z1).toBe(100); // kept
    expect(player.lastDamageTime.zGone).toBeUndefined();
  });

  test('removes orphaned poison trail entries', () => {
    const player = {
      lastPoisonDamage: { t1: 500, tGone: 600 },
      lastPoisonDamageByTrail: { t1: 500, tGone: 600 }
    };
    const gameState = {
      _lastTrackingCleanup: 500,
      players: { p1: player },
      zombies: {},
      poisonTrails: { t1: {} }
    };
    cleanupOrphanedTrackingData(gameState, 2000);
    expect(player.lastPoisonDamage.tGone).toBeUndefined();
    expect(player.lastPoisonDamage.t1).toBe(500);
    expect(player.lastPoisonDamageByTrail.tGone).toBeUndefined();
  });

  test('ignores players without tracking maps', () => {
    const gameState = {
      _lastTrackingCleanup: 0,
      players: { p1: {} },
      zombies: {},
      poisonTrails: {}
    };
    expect(() => cleanupOrphanedTrackingData(gameState, 2000)).not.toThrow();
  });
});
