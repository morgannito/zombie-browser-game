/**
 * PLAYER ENTITY - Unit Tests
 * Tests pure domain logic without infrastructure dependencies
 */

const Player = require('../../../lib/domain/entities/Player');

describe('Player Entity', () => {
  const validPlayerData = {
    id: 'player-001',
    username: 'TestPlayer',
    totalKills: 0,
    totalDeaths: 0,
    highestWave: 0,
    highestLevel: 0,
    totalPlaytime: 0,
    totalGoldEarned: 0
  };

  describe('constructor', () => {
    it('should create a player with valid data', () => {
      const player = new Player(validPlayerData);

      expect(player.id).toBe('player-001');
      expect(player.username).toBe('TestPlayer');
      expect(player.totalKills).toBe(0);
      expect(player.totalDeaths).toBe(0);
      expect(player.highestWave).toBe(0);
      expect(player.highestLevel).toBe(0);
      expect(player.totalPlaytime).toBe(0);
      expect(player.totalGoldEarned).toBe(0);
    });

    it('should set default values when optional fields are omitted', () => {
      const player = new Player({ id: 'p-1', username: 'Min' });

      expect(player.totalKills).toBe(0);
      expect(player.totalDeaths).toBe(0);
      expect(player.highestWave).toBe(0);
      expect(player.highestLevel).toBe(0);
      expect(player.totalPlaytime).toBe(0);
      expect(player.totalGoldEarned).toBe(0);
      expect(player.createdAt).toBeDefined();
      expect(player.lastSeen).toBeDefined();
    });

    it('should preserve provided timestamps', () => {
      const createdAt = 1700000000000;
      const lastSeen = 1700001000000;
      const player = new Player({
        ...validPlayerData,
        createdAt,
        lastSeen
      });

      expect(player.createdAt).toBe(createdAt);
      expect(player.lastSeen).toBe(lastSeen);
    });
  });

  describe('updateStats', () => {
    it('should accumulate kills and deaths', () => {
      const player = new Player(validPlayerData);

      player.updateStats({
        kills: 50,
        deaths: 3,
        wave: 5,
        level: 10,
        playtime: 300,
        goldEarned: 500
      });

      expect(player.totalKills).toBe(50);
      expect(player.totalDeaths).toBe(3);
    });

    it('should accumulate stats across multiple updates', () => {
      const player = new Player(validPlayerData);

      player.updateStats({
        kills: 20,
        deaths: 1,
        wave: 3,
        level: 5,
        playtime: 120,
        goldEarned: 200
      });

      player.updateStats({
        kills: 30,
        deaths: 2,
        wave: 7,
        level: 12,
        playtime: 180,
        goldEarned: 350
      });

      expect(player.totalKills).toBe(50);
      expect(player.totalDeaths).toBe(3);
      expect(player.totalPlaytime).toBe(300);
      expect(player.totalGoldEarned).toBe(550);
    });

    it('should keep the highest wave (max behavior)', () => {
      const player = new Player(validPlayerData);

      player.updateStats({
        kills: 10,
        deaths: 0,
        wave: 5,
        level: 3,
        playtime: 60,
        goldEarned: 100
      });

      player.updateStats({
        kills: 5,
        deaths: 1,
        wave: 3,
        level: 2,
        playtime: 40,
        goldEarned: 50
      });

      expect(player.highestWave).toBe(5);
    });

    it('should keep the highest level (max behavior)', () => {
      const player = new Player(validPlayerData);

      player.updateStats({
        kills: 10,
        deaths: 0,
        wave: 3,
        level: 8,
        playtime: 60,
        goldEarned: 100
      });

      player.updateStats({
        kills: 5,
        deaths: 1,
        wave: 2,
        level: 4,
        playtime: 40,
        goldEarned: 50
      });

      expect(player.highestLevel).toBe(8);
    });

    it('should update lastSeen timestamp', () => {
      const player = new Player({ ...validPlayerData, lastSeen: 1000 });
      const beforeUpdate = Date.now();

      player.updateStats({
        kills: 1,
        deaths: 0,
        wave: 1,
        level: 1,
        playtime: 10,
        goldEarned: 10
      });

      expect(player.lastSeen).toBeGreaterThanOrEqual(beforeUpdate);
    });
  });

  describe('getKDRatio', () => {
    it('should return totalKills when deaths are zero', () => {
      const player = new Player({ ...validPlayerData, totalKills: 100, totalDeaths: 0 });

      expect(player.getKDRatio()).toBe(100);
    });

    it('should return correct ratio with deaths', () => {
      const player = new Player({ ...validPlayerData, totalKills: 100, totalDeaths: 25 });

      expect(player.getKDRatio()).toBe(4);
    });

    it('should return zero when no kills and no deaths', () => {
      const player = new Player(validPlayerData);

      expect(player.getKDRatio()).toBe(0);
    });

    it('should handle fractional ratios correctly', () => {
      const player = new Player({ ...validPlayerData, totalKills: 10, totalDeaths: 3 });

      expect(player.getKDRatio()).toBeCloseTo(3.33, 2);
    });
  });

  describe('calculateScore', () => {
    it('should calculate score with correct formula', () => {
      const player = new Player({
        ...validPlayerData,
        totalKills: 100, // 100 * 10 = 1000
        highestWave: 10, // 10 * 100 = 1000
        highestLevel: 20, // 20 * 50  = 1000
        totalGoldEarned: 500 // 500
      });

      // 1000 + 1000 + 1000 + 500 = 3500
      expect(player.calculateScore()).toBe(3500);
    });

    it('should return zero for a fresh player', () => {
      const player = new Player(validPlayerData);

      expect(player.calculateScore()).toBe(0);
    });

    it('should weight wave higher than level', () => {
      const playerA = new Player({
        ...validPlayerData,
        highestWave: 10,
        highestLevel: 0
      });
      const playerB = new Player({
        ...validPlayerData,
        highestWave: 0,
        highestLevel: 10
      });

      expect(playerA.calculateScore()).toBeGreaterThan(playerB.calculateScore());
    });
  });

  describe('isNewRecord', () => {
    it('should detect new wave record', () => {
      const player = new Player({ ...validPlayerData, highestWave: 5, highestLevel: 10 });

      expect(player.isNewRecord(6, 8)).toBe(true);
    });

    it('should detect new level record', () => {
      const player = new Player({ ...validPlayerData, highestWave: 5, highestLevel: 10 });

      expect(player.isNewRecord(3, 11)).toBe(true);
    });

    it('should detect when both wave and level are records', () => {
      const player = new Player({ ...validPlayerData, highestWave: 5, highestLevel: 10 });

      expect(player.isNewRecord(8, 15)).toBe(true);
    });

    it('should return false when neither is a record', () => {
      const player = new Player({ ...validPlayerData, highestWave: 10, highestLevel: 20 });

      expect(player.isNewRecord(5, 10)).toBe(false);
    });

    it('should return false when values are equal (not strictly greater)', () => {
      const player = new Player({ ...validPlayerData, highestWave: 10, highestLevel: 20 });

      expect(player.isNewRecord(10, 20)).toBe(false);
    });
  });

  describe('fromDB', () => {
    it('should reconstruct a Player from a database row', () => {
      const dbRow = {
        id: 'db-player-1',
        username: 'DBPlayer',
        total_kills: 250,
        total_deaths: 30,
        highest_wave: 15,
        highest_level: 25,
        total_playtime: 7200,
        total_gold_earned: 5000,
        created_at: 1700000000, // seconds (SQLite)
        last_seen: 1700005000 // seconds (SQLite)
      };

      const player = Player.fromDB(dbRow);

      expect(player.id).toBe('db-player-1');
      expect(player.username).toBe('DBPlayer');
      expect(player.totalKills).toBe(250);
      expect(player.totalDeaths).toBe(30);
      expect(player.highestWave).toBe(15);
      expect(player.highestLevel).toBe(25);
      expect(player.totalPlaytime).toBe(7200);
      expect(player.totalGoldEarned).toBe(5000);
      expect(player.createdAt).toBe(1700000000 * 1000);
      expect(player.lastSeen).toBe(1700005000 * 1000);
    });

    it('should produce a valid Player instance with domain methods', () => {
      const dbRow = {
        id: 'db-2',
        username: 'MethodTest',
        total_kills: 100,
        total_deaths: 10,
        highest_wave: 8,
        highest_level: 12,
        total_playtime: 3600,
        total_gold_earned: 2000,
        created_at: 1700000000,
        last_seen: 1700001000
      };

      const player = Player.fromDB(dbRow);

      expect(player.getKDRatio()).toBe(10);
      expect(player.calculateScore()).toBe(100 * 10 + 8 * 100 + 12 * 50 + 2000);
      expect(player.isNewRecord(10, 15)).toBe(true);
    });
  });

  describe('toObject', () => {
    it('should return a plain object with all fields', () => {
      const player = new Player({
        ...validPlayerData,
        createdAt: 1000,
        lastSeen: 2000
      });

      const obj = player.toObject();

      expect(obj).toEqual({
        id: 'player-001',
        username: 'TestPlayer',
        totalKills: 0,
        totalDeaths: 0,
        highestWave: 0,
        highestLevel: 0,
        totalPlaytime: 0,
        totalGoldEarned: 0,
        createdAt: 1000,
        lastSeen: 2000
      });
    });
  });
});
