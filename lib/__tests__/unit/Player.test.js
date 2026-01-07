/**
 * PLAYER ENTITY TESTS - Unit tests for domain logic
 * TDD approach: Tests before features, domain only
 */

const Player = require('../../domain/entities/Player');

describe('Player Entity - Domain Logic', () => {
  describe('Constructor', () => {
    it('should create player with required fields', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer'
      });

      expect(player.id).toBe('test-id');
      expect(player.username).toBe('TestPlayer');
      expect(player.totalKills).toBe(0);
      expect(player.totalDeaths).toBe(0);
      expect(player.highestWave).toBe(0);
      expect(player.highestLevel).toBe(0);
    });

    it('should create player with custom stats', () => {
      const player = new Player({
        id: 'test-id',
        username: 'Veteran',
        totalKills: 500,
        totalDeaths: 10,
        highestWave: 50,
        highestLevel: 75
      });

      expect(player.totalKills).toBe(500);
      expect(player.totalDeaths).toBe(10);
      expect(player.highestWave).toBe(50);
      expect(player.highestLevel).toBe(75);
    });
  });

  describe('updateStats()', () => {
    it('should increment stats correctly', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        totalKills: 100,
        totalDeaths: 5,
        totalPlaytime: 1000,
        totalGoldEarned: 500
      });

      player.updateStats({
        kills: 50,
        deaths: 2,
        wave: 10,
        level: 20,
        playtime: 300,
        goldEarned: 200
      });

      expect(player.totalKills).toBe(150);
      expect(player.totalDeaths).toBe(7);
      expect(player.totalPlaytime).toBe(1300);
      expect(player.totalGoldEarned).toBe(700);
    });

    it('should update highest wave if new wave is higher', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestWave: 10
      });

      player.updateStats({ kills: 0, deaths: 0, wave: 15, level: 0, playtime: 0, goldEarned: 0 });

      expect(player.highestWave).toBe(15);
    });

    it('should NOT update highest wave if new wave is lower', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestWave: 20
      });

      player.updateStats({ kills: 0, deaths: 0, wave: 10, level: 0, playtime: 0, goldEarned: 0 });

      expect(player.highestWave).toBe(20);
    });

    it('should update highest level correctly', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestLevel: 50
      });

      player.updateStats({ kills: 0, deaths: 0, wave: 0, level: 75, playtime: 0, goldEarned: 0 });

      expect(player.highestLevel).toBe(75);
    });

    it('should update lastSeen timestamp', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        lastSeen: 1000000
      });

      const beforeUpdate = Date.now();
      player.updateStats({ kills: 0, deaths: 0, wave: 0, level: 0, playtime: 0, goldEarned: 0 });
      const afterUpdate = Date.now();

      expect(player.lastSeen).toBeGreaterThanOrEqual(beforeUpdate);
      expect(player.lastSeen).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('isNewRecord()', () => {
    it('should return true when wave is new record', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestWave: 10,
        highestLevel: 20
      });

      expect(player.isNewRecord(15, 15)).toBe(true);
    });

    it('should return true when level is new record', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestWave: 10,
        highestLevel: 20
      });

      expect(player.isNewRecord(5, 25)).toBe(true);
    });

    it('should return false when neither is new record', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestWave: 10,
        highestLevel: 20
      });

      expect(player.isNewRecord(5, 15)).toBe(false);
    });

    it('should return false when equal to current records', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        highestWave: 10,
        highestLevel: 20
      });

      expect(player.isNewRecord(10, 20)).toBe(false);
    });
  });

  describe('calculateScore()', () => {
    it('should calculate score correctly based on formula', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        totalKills: 100,      // 100 * 10 = 1000
        highestWave: 10,      // 10 * 100 = 1000
        highestLevel: 20,     // 20 * 50 = 1000
        totalGoldEarned: 500  // 500
      });

      // 1000 + 1000 + 1000 + 500 = 3500
      expect(player.calculateScore()).toBe(3500);
    });

    it('should return 0 for new player', () => {
      const player = new Player({
        id: 'test-id',
        username: 'NewPlayer'
      });

      expect(player.calculateScore()).toBe(0);
    });

    it('should handle large numbers correctly', () => {
      const player = new Player({
        id: 'test-id',
        username: 'ProPlayer',
        totalKills: 10000,
        highestWave: 100,
        highestLevel: 200,
        totalGoldEarned: 50000
      });

      // 100000 + 10000 + 10000 + 50000 = 170000
      expect(player.calculateScore()).toBe(170000);
    });
  });

  describe('getKDRatio()', () => {
    it('should calculate K/D ratio correctly', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        totalKills: 100,
        totalDeaths: 20
      });

      expect(player.getKDRatio()).toBe('5.00');
    });

    it('should return totalKills when deaths is 0', () => {
      const player = new Player({
        id: 'test-id',
        username: 'Immortal',
        totalKills: 150,
        totalDeaths: 0
      });

      expect(player.getKDRatio()).toBe(150);
    });

    it('should format decimals to 2 places', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        totalKills: 100,
        totalDeaths: 33
      });

      expect(player.getKDRatio()).toBe('3.03');
    });

    it('should handle low K/D ratio', () => {
      const player = new Player({
        id: 'test-id',
        username: 'Noob',
        totalKills: 10,
        totalDeaths: 100
      });

      expect(player.getKDRatio()).toBe('0.10');
    });
  });

  describe('toObject()', () => {
    it('should serialize all fields correctly', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer',
        totalKills: 100,
        totalDeaths: 10,
        highestWave: 20,
        highestLevel: 30,
        totalPlaytime: 5000,
        totalGoldEarned: 1500,
        createdAt: 1000000,
        lastSeen: 2000000
      });

      const obj = player.toObject();

      expect(obj).toEqual({
        id: 'test-id',
        username: 'TestPlayer',
        totalKills: 100,
        totalDeaths: 10,
        highestWave: 20,
        highestLevel: 30,
        totalPlaytime: 5000,
        totalGoldEarned: 1500,
        createdAt: 1000000,
        lastSeen: 2000000
      });
    });

    it('should be JSON serializable', () => {
      const player = new Player({
        id: 'test-id',
        username: 'TestPlayer'
      });

      expect(() => JSON.stringify(player.toObject())).not.toThrow();
    });
  });

  describe('fromDB()', () => {
    it('should create Player from database row', () => {
      const dbRow = {
        id: 'db-id',
        username: 'DBPlayer',
        total_kills: 200,
        total_deaths: 15,
        highest_wave: 25,
        highest_level: 35,
        total_playtime: 10000,
        total_gold_earned: 3000,
        created_at: 1000, // SQLite timestamp in seconds
        last_seen: 2000
      };

      const player = Player.fromDB(dbRow);

      expect(player.id).toBe('db-id');
      expect(player.username).toBe('DBPlayer');
      expect(player.totalKills).toBe(200);
      expect(player.totalDeaths).toBe(15);
      expect(player.highestWave).toBe(25);
      expect(player.highestLevel).toBe(35);
      expect(player.totalPlaytime).toBe(10000);
      expect(player.totalGoldEarned).toBe(3000);
      expect(player.createdAt).toBe(1000000); // Converted to milliseconds
      expect(player.lastSeen).toBe(2000000);
    });

    it('should convert SQLite timestamps correctly', () => {
      const dbRow = {
        id: 'test-id',
        username: 'TestPlayer',
        total_kills: 0,
        total_deaths: 0,
        highest_wave: 0,
        highest_level: 0,
        total_playtime: 0,
        total_gold_earned: 0,
        created_at: 1704067200, // 2024-01-01 00:00:00 UTC in seconds
        last_seen: 1704153600   // 2024-01-02 00:00:00 UTC in seconds
      };

      const player = Player.fromDB(dbRow);

      expect(player.createdAt).toBe(1704067200000); // Milliseconds
      expect(player.lastSeen).toBe(1704153600000);
    });
  });
});
