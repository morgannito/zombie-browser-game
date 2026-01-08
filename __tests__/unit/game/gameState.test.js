/**
 * Unit tests for game/gameState.js
 * SSS Quality: Critical game state initialization tests
 */

const { initializeGameState } = require('../../../game/gameState');

describe('Game State Initialization', () => {
  let gameState;

  beforeEach(() => {
    gameState = initializeGameState();
  });

  test('should initialize all game state objects', () => {
    expect(gameState).toBeDefined();
    expect(gameState.players).toEqual({});
    expect(gameState.zombies).toEqual({});
    expect(gameState.bullets).toEqual({});
    expect(gameState.powerups).toEqual({});
    expect(gameState.particles).toEqual({});
    expect(gameState.poisonTrails).toEqual({});
    expect(gameState.loot).toEqual({});
    expect(gameState.explosions).toEqual({});
  });

  test('should initialize arrays', () => {
    expect(Array.isArray(gameState.walls)).toBe(true);
    expect(Array.isArray(gameState.rooms)).toBe(true);
  });

  test('should initialize ID counters to 0', () => {
    expect(gameState.nextZombieId).toBe(0);
    expect(gameState.nextBulletId).toBe(0);
    expect(gameState.nextPowerupId).toBe(0);
    expect(gameState.nextParticleId).toBe(0);
    expect(gameState.nextPoisonTrailId).toBe(0);
    expect(gameState.nextLootId).toBe(0);
    expect(gameState.nextExplosionId).toBe(0);
  });

  test('should initialize wave state', () => {
    expect(gameState.wave).toBe(1);
    expect(gameState.zombiesKilledThisWave).toBe(0);
    expect(gameState.zombiesSpawnedThisWave).toBe(0);
    expect(gameState.bossSpawned).toBe(false);
    expect(gameState.currentRoom).toBe(0);
  });

  test('should initialize permanent upgrades', () => {
    expect(gameState.permanentUpgrades).toBeDefined();
    expect(gameState.permanentUpgrades.maxHealthUpgrade).toBe(0);
    expect(gameState.permanentUpgrades.damageUpgrade).toBe(0);
    expect(gameState.permanentUpgrades.speedUpgrade).toBe(0);
    expect(gameState.permanentUpgrades.goldMultiplier).toBe(1);
  });

  describe('getNextId() - ID overflow protection', () => {
    test('should increment counter and return next ID', () => {
      const id1 = gameState.getNextId('nextZombieId');
      const id2 = gameState.getNextId('nextZombieId');
      const id3 = gameState.getNextId('nextZombieId');

      expect(id1).toBe(0);
      expect(id2).toBe(1);
      expect(id3).toBe(2);
      expect(gameState.nextZombieId).toBe(3);
    });

    test('should handle invalid counter names', () => {
      const id = gameState.getNextId('invalidCounter');
      expect(id).toBe(0);
      expect(gameState.invalidCounter).toBe(1);
    });

    test('should rollover at MAX_SAFE_ID threshold', () => {
      const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER - 1000;
      gameState.nextBulletId = MAX_SAFE_ID;

      const id = gameState.getNextId('nextBulletId');

      expect(id).toBe(0);
      expect(gameState.nextBulletId).toBe(1);
    });

    test('should handle concurrent ID generation', () => {
      const ids = [];
      for (let i = 0; i < 1000; i++) {
        ids.push(gameState.getNextId('nextParticleId'));
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1000);

      // IDs should be sequential
      expect(ids[0]).toBe(0);
      expect(ids[999]).toBe(999);
    });
  });
});
