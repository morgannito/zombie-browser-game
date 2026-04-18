/**
 * LEADERBOARD ENTRY ENTITY - Unit Tests
 * Tests score calculation, ranking comparison, serialization
 */

const LeaderboardEntry = require('../../../lib/domain/entities/LeaderboardEntry');

describe('LeaderboardEntry Entity', () => {
  const validEntryData = {
    id: 'entry-001',
    playerId: 'player-001',
    playerUsername: 'TestPlayer',
    wave: 10,
    level: 15,
    kills: 200,
    survivalTime: 600,
    score: 3850
  };

  describe('constructor invariants', () => {
    it('should throw when playerId is missing', () => {
      expect(() => new LeaderboardEntry({ ...validEntryData, playerId: '' })).toThrow('playerId is required');
    });

    it('should throw when playerUsername is missing', () => {
      expect(() => new LeaderboardEntry({ ...validEntryData, playerUsername: '' })).toThrow('playerUsername is required');
    });

    it('should throw when wave is negative', () => {
      expect(() => new LeaderboardEntry({ ...validEntryData, wave: -1 })).toThrow('wave must be >= 0');
    });

    it('should throw when kills is negative', () => {
      expect(() => new LeaderboardEntry({ ...validEntryData, kills: -5 })).toThrow('kills must be >= 0');
    });

    it('should throw when score is negative', () => {
      expect(() => new LeaderboardEntry({ ...validEntryData, score: -10 })).toThrow('score must be >= 0');
    });
  });

  describe('constructor', () => {
    it('should create an entry with valid data', () => {
      const entry = new LeaderboardEntry(validEntryData);

      expect(entry.id).toBe('entry-001');
      expect(entry.playerId).toBe('player-001');
      expect(entry.playerUsername).toBe('TestPlayer');
      expect(entry.wave).toBe(10);
      expect(entry.level).toBe(15);
      expect(entry.kills).toBe(200);
      expect(entry.survivalTime).toBe(600);
      expect(entry.score).toBe(3850);
      expect(entry.createdAt).toBeDefined();
    });

    it('should default id to null', () => {
      const entry = new LeaderboardEntry({
        playerId: 'p-1',
        playerUsername: 'User',
        wave: 1,
        level: 1,
        kills: 5,
        survivalTime: 30,
        score: 100
      });

      expect(entry.id).toBeNull();
    });

    it('should accept a custom createdAt', () => {
      const ts = 1700000000000;
      const entry = new LeaderboardEntry({
        ...validEntryData,
        createdAt: ts
      });

      expect(entry.createdAt).toBe(ts);
    });
  });

  describe('calculateScore (static)', () => {
    it('should calculate composite score correctly', () => {
      // wave * 100 + level * 50 + kills * 10 + floor(survivalTime / 60) * 5
      const score = LeaderboardEntry.calculateScore(10, 15, 200, 600);

      const expected = 10 * 100 + 15 * 50 + 200 * 10 + Math.floor(600 / 60) * 5;
      // 1000 + 750 + 2000 + 50 = 3800
      expect(score).toBe(expected);
    });

    it('should return 0 for all-zero inputs', () => {
      expect(LeaderboardEntry.calculateScore(0, 0, 0, 0)).toBe(0);
    });

    it('should floor the survival time minutes', () => {
      // 90 seconds = 1 full minute = 5 points
      const score = LeaderboardEntry.calculateScore(0, 0, 0, 90);

      expect(score).toBe(5);
    });

    it('should weight wave highest (per unit) after kills volume', () => {
      // 1 wave = 100, 1 level = 50, 1 kill = 10
      const waveOnly = LeaderboardEntry.calculateScore(1, 0, 0, 0);
      const levelOnly = LeaderboardEntry.calculateScore(0, 1, 0, 0);
      const killOnly = LeaderboardEntry.calculateScore(0, 0, 1, 0);

      expect(waveOnly).toBeGreaterThan(levelOnly);
      expect(levelOnly).toBeGreaterThan(killOnly);
    });
  });

  describe('getFormattedSurvivalTime', () => {
    it('should format seconds as MM:SS', () => {
      const entry = new LeaderboardEntry({
        ...validEntryData,
        survivalTime: 125 // 2 min 5 sec
      });

      expect(entry.getFormattedSurvivalTime()).toBe('2:05');
    });

    it('should handle zero seconds', () => {
      const entry = new LeaderboardEntry({
        ...validEntryData,
        survivalTime: 0
      });

      expect(entry.getFormattedSurvivalTime()).toBe('0:00');
    });

    it('should handle exact minutes', () => {
      const entry = new LeaderboardEntry({
        ...validEntryData,
        survivalTime: 300
      });

      expect(entry.getFormattedSurvivalTime()).toBe('5:00');
    });

    it('should pad single-digit seconds', () => {
      const entry = new LeaderboardEntry({
        ...validEntryData,
        survivalTime: 63
      });

      expect(entry.getFormattedSurvivalTime()).toBe('1:03');
    });
  });

  describe('isBetterThan', () => {
    it('should rank higher score as better', () => {
      const entryA = new LeaderboardEntry({ ...validEntryData, score: 5000 });
      const entryB = new LeaderboardEntry({ ...validEntryData, score: 3000 });

      expect(entryA.isBetterThan(entryB)).toBe(true);
      expect(entryB.isBetterThan(entryA)).toBe(false);
    });

    it('should use wave as tiebreaker when scores are equal', () => {
      const entryA = new LeaderboardEntry({ ...validEntryData, score: 5000, wave: 12 });
      const entryB = new LeaderboardEntry({ ...validEntryData, score: 5000, wave: 10 });

      expect(entryA.isBetterThan(entryB)).toBe(true);
      expect(entryB.isBetterThan(entryA)).toBe(false);
    });

    it('should use kills as final tiebreaker', () => {
      const entryA = new LeaderboardEntry({
        ...validEntryData,
        score: 5000,
        wave: 10,
        kills: 300
      });
      const entryB = new LeaderboardEntry({
        ...validEntryData,
        score: 5000,
        wave: 10,
        kills: 200
      });

      expect(entryA.isBetterThan(entryB)).toBe(true);
      expect(entryB.isBetterThan(entryA)).toBe(false);
    });

    it('should return false when entries are identical', () => {
      const entryA = new LeaderboardEntry(validEntryData);
      const entryB = new LeaderboardEntry(validEntryData);

      // Same score, same wave, same kills -> kills tiebreaker: 200 > 200 is false
      expect(entryA.isBetterThan(entryB)).toBe(false);
    });
  });

  describe('fromDB', () => {
    it('should reconstruct from database row', () => {
      const dbRow = {
        id: 42,
        player_id: 'db-p-1',
        username: 'DBUser',
        wave: 8,
        level: 12,
        kills: 150,
        survival_time: 420,
        score: 2700,
        created_at: 1700000000
      };

      const entry = LeaderboardEntry.fromDB(dbRow);

      expect(entry.id).toBe(42);
      expect(entry.playerId).toBe('db-p-1');
      expect(entry.playerUsername).toBe('DBUser');
      expect(entry.wave).toBe(8);
      expect(entry.level).toBe(12);
      expect(entry.kills).toBe(150);
      expect(entry.survivalTime).toBe(420);
      expect(entry.score).toBe(2700);
      expect(entry.createdAt).toBe(1700000000 * 1000);
    });

    it('should prefer explicit username parameter over row.username', () => {
      const dbRow = {
        id: 1,
        player_id: 'p-1',
        username: 'RowUsername',
        wave: 1,
        level: 1,
        kills: 1,
        survival_time: 10,
        score: 100,
        created_at: 1700000000
      };

      const entry = LeaderboardEntry.fromDB(dbRow, 'OverrideUsername');

      expect(entry.playerUsername).toBe('OverrideUsername');
    });
  });

  describe('toObject', () => {
    it('should return a plain object with all fields', () => {
      const entry = new LeaderboardEntry({
        ...validEntryData,
        createdAt: 5000
      });

      expect(entry.toObject()).toEqual({
        id: 'entry-001',
        playerId: 'player-001',
        playerUsername: 'TestPlayer',
        wave: 10,
        level: 15,
        kills: 200,
        survivalTime: 600,
        score: 3850,
        createdAt: 5000
      });
    });
  });
});
