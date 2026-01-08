/**
 * @fileoverview HazardManager Unit Tests
 * @description Tests hazard creation, damage application, and cleanup
 */

const HazardManager = require('../HazardManager');

describe('HazardManager', () => {
  let hazardManager;
  let gameState;
  let entityManager;

  beforeEach(() => {
    // Mock gameState
    gameState = {
      hazards: [],
      toxicPools: [],
      players: {
        player1: {
          id: 'player1',
          alive: true,
          x: 100,
          y: 100,
          health: 100,
          spawnProtection: false,
          invisible: false,
          deaths: 0
        },
        player2: {
          id: 'player2',
          alive: true,
          x: 500,
          y: 500,
          health: 100,
          spawnProtection: false,
          invisible: false,
          deaths: 0
        }
      }
    };

    // Mock entityManager
    entityManager = {
      createParticle: jest.fn(),
      createParticles: jest.fn(),
      particles: []
    };

    hazardManager = new HazardManager(gameState, entityManager);
  });

  describe('initialize', () => {
    it('should initialize hazards array', () => {
      gameState.hazards = undefined;
      gameState.toxicPools = undefined;

      hazardManager.initialize();

      expect(gameState.hazards).toEqual([]);
      expect(gameState.toxicPools).toEqual([]);
    });

    it('should not overwrite existing hazards', () => {
      gameState.hazards = [{ type: 'test' }];
      gameState.toxicPools = [{ id: 'pool1' }];

      hazardManager.initialize();

      expect(gameState.hazards).toEqual([{ type: 'test' }]);
      expect(gameState.toxicPools).toEqual([{ id: 'pool1' }]);
    });
  });

  describe('createHazard', () => {
    it('should create meteor hazard', () => {
      const hazard = hazardManager.createHazard('meteor', 100, 100, 50, 60, 2000);

      expect(hazard).toBeDefined();
      expect(hazard.type).toBe('meteor');
      expect(hazard.x).toBe(100);
      expect(hazard.y).toBe(100);
      expect(hazard.radius).toBe(50);
      expect(hazard.damage).toBe(60);
      expect(hazard.duration).toBe(2000);
      expect(hazard.damageInterval).toBe(500);
      expect(hazard.createdAt).toBeDefined();
    });

    it('should create ice spike hazard', () => {
      const hazard = hazardManager.createHazard('iceSpike', 200, 200, 60, 50, 3000);

      expect(hazard.type).toBe('iceSpike');
      expect(hazard.radius).toBe(60);
      expect(hazard.damage).toBe(50);
    });

    it('should create lightning hazard', () => {
      const hazard = hazardManager.createHazard('lightning', 300, 300, 70, 40, 1000);

      expect(hazard.type).toBe('lightning');
      expect(hazard.radius).toBe(70);
      expect(hazard.damage).toBe(40);
    });

    it('should create void rift hazard', () => {
      const hazard = hazardManager.createHazard('voidRift', 400, 400, 120, 45, 12000);

      expect(hazard.type).toBe('voidRift');
      expect(hazard.radius).toBe(120);
      expect(hazard.damage).toBe(45);
    });

    it('should add hazard to gameState.hazards array', () => {
      hazardManager.createHazard('meteor', 100, 100, 50, 60, 2000);

      expect(gameState.hazards.length).toBe(1);
      expect(gameState.hazards[0].type).toBe('meteor');
    });

    it('should create visual spawn effect', () => {
      hazardManager.createHazard('meteor', 100, 100, 50, 60, 2000);

      // Should create particles (mocked)
      expect(entityManager.createParticles).toHaveBeenCalled();
    });
  });

  describe('createToxicPool', () => {
    it('should create toxic pool', () => {
      const pool = hazardManager.createToxicPool(100, 100, 80, 30, 10000);

      expect(pool).toBeDefined();
      expect(pool.id).toMatch(/^toxic_/);
      expect(pool.x).toBe(100);
      expect(pool.y).toBe(100);
      expect(pool.radius).toBe(80);
      expect(pool.damage).toBe(30);
      expect(pool.duration).toBe(10000);
    });

    it('should add toxic pool to gameState.toxicPools', () => {
      hazardManager.createToxicPool(100, 100, 80, 30, 10000);

      expect(gameState.toxicPools.length).toBe(1);
      expect(gameState.toxicPools[0].radius).toBe(80);
    });

    it('should generate unique IDs', () => {
      const pool1 = hazardManager.createToxicPool(100, 100, 80, 30, 10000);
      const pool2 = hazardManager.createToxicPool(200, 200, 80, 30, 10000);

      expect(pool1.id).not.toBe(pool2.id);
    });
  });

  describe('updateHazards', () => {
    it('should remove expired hazards', () => {
      const now = Date.now();

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 50,
        damage: 60,
        createdAt: now - 3000,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.hazards.length).toBe(0);
    });

    it('should keep non-expired hazards', () => {
      const now = Date.now();

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 50,
        damage: 60,
        createdAt: now - 1000,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.hazards.length).toBe(1);
    });

    it('should apply damage to players in radius', () => {
      const now = Date.now();

      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 100;

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000,
        damageInterval: 500
      });

      hazardManager.updateHazards(now);

      expect(gameState.players.player1.health).toBe(80);
    });

    it('should not damage players outside radius', () => {
      const now = Date.now();

      gameState.players.player2.x = 500;
      gameState.players.player2.y = 500;
      gameState.players.player2.health = 100;

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.players.player2.health).toBe(100);
    });

    it('should not damage dead players', () => {
      const now = Date.now();

      gameState.players.player1.alive = false;
      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 0;

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.players.player1.health).toBe(0);
    });

    it('should not damage players with spawn protection', () => {
      const now = Date.now();

      gameState.players.player1.spawnProtection = true;
      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 100;

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.players.player1.health).toBe(100);
    });

    it('should not damage invisible players', () => {
      const now = Date.now();

      gameState.players.player1.invisible = true;
      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 100;

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.players.player1.health).toBe(100);
    });

    it('should kill player if health drops to zero', () => {
      const now = Date.now();

      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 10;

      gameState.hazards.push({
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000
      });

      hazardManager.updateHazards(now);

      expect(gameState.players.player1.health).toBeLessThanOrEqual(0);
      expect(gameState.players.player1.alive).toBe(false);
      expect(gameState.players.player1.deaths).toBe(1);
    });

    it('should respect damage interval cooldown', () => {
      const now = Date.now();

      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 100;

      const hazard = {
        type: 'meteor',
        x: 100,
        y: 100,
        radius: 100,
        damage: 20,
        createdAt: now,
        duration: 2000,
        damageInterval: 500,
        lastDamageTick: now
      };

      gameState.hazards.push(hazard);

      // Call immediately (should not apply damage due to cooldown)
      hazardManager.updateHazards(now);

      expect(gameState.players.player1.health).toBe(100);

      // Call after cooldown (should apply damage)
      hazardManager.updateHazards(now + 600);

      expect(gameState.players.player1.health).toBe(80);
    });
  });

  describe('updateToxicPools', () => {
    it('should remove expired toxic pools', () => {
      const now = Date.now();

      gameState.toxicPools.push({
        id: 'pool1',
        x: 100,
        y: 100,
        radius: 80,
        damage: 30,
        createdAt: now - 11000,
        duration: 10000
      });

      hazardManager.updateToxicPools(now);

      expect(gameState.toxicPools.length).toBe(0);
    });

    it('should apply damage to players in toxic pool', () => {
      const now = Date.now();

      gameState.players.player1.x = 100;
      gameState.players.player1.y = 100;
      gameState.players.player1.health = 100;

      gameState.toxicPools.push({
        id: 'pool1',
        x: 100,
        y: 100,
        radius: 80,
        damage: 30,
        createdAt: now,
        duration: 10000
      });

      hazardManager.updateToxicPools(now);

      expect(gameState.players.player1.health).toBe(85); // 30/2 = 15 damage per tick
    });
  });

  describe('getHazardColor', () => {
    it('should return correct color for meteor', () => {
      const color = hazardManager.getHazardColor('meteor');
      expect(color).toBe('#ff0000');
    });

    it('should return correct color for iceSpike', () => {
      const color = hazardManager.getHazardColor('iceSpike');
      expect(color).toBe('#00bfff');
    });

    it('should return correct color for lightning', () => {
      const color = hazardManager.getHazardColor('lightning');
      expect(color).toBe('#ffff00');
    });

    it('should return correct color for lavaPool', () => {
      const color = hazardManager.getHazardColor('lavaPool');
      expect(color).toBe('#ff4500');
    });

    it('should return correct color for voidRift', () => {
      const color = hazardManager.getHazardColor('voidRift');
      expect(color).toBe('#9400d3');
    });

    it('should return default color for unknown type', () => {
      const color = hazardManager.getHazardColor('unknown');
      expect(color).toBe('#ffffff');
    });
  });

  describe('clearAll', () => {
    it('should clear all hazards and toxic pools', () => {
      gameState.hazards.push({ type: 'meteor' });
      gameState.toxicPools.push({ id: 'pool1' });

      hazardManager.clearAll();

      expect(gameState.hazards).toEqual([]);
      expect(gameState.toxicPools).toEqual([]);
    });
  });

  describe('getCount', () => {
    it('should return correct counts', () => {
      gameState.hazards.push({ type: 'meteor' });
      gameState.hazards.push({ type: 'iceSpike' });
      gameState.toxicPools.push({ id: 'pool1' });

      const count = hazardManager.getCount();

      expect(count.hazards).toBe(2);
      expect(count.pools).toBe(1);
      expect(count.total).toBe(3);
    });

    it('should handle empty arrays', () => {
      gameState.hazards = [];
      gameState.toxicPools = [];

      const count = hazardManager.getCount();

      expect(count.hazards).toBe(0);
      expect(count.pools).toBe(0);
      expect(count.total).toBe(0);
    });
  });

  describe('update', () => {
    it('should call updateHazards and updateToxicPools', () => {
      const spy1 = jest.spyOn(hazardManager, 'updateHazards');
      const spy2 = jest.spyOn(hazardManager, 'updateToxicPools');

      const now = Date.now();
      hazardManager.update(now);

      expect(spy1).toHaveBeenCalledWith(now);
      expect(spy2).toHaveBeenCalledWith(now);
    });
  });
});
