/**
 * ACCOUNT PROGRESSION ENTITY - Unit Tests
 * Tests XP system, level ups, skill points, prestige mechanics
 */

const AccountProgression = require('../../../lib/domain/entities/AccountProgression');

describe('AccountProgression Entity', () => {
  const baseData = {
    playerId: 'player-001'
  };

  describe('constructor', () => {
    it('should create with default values', () => {
      const prog = new AccountProgression(baseData);

      expect(prog.playerId).toBe('player-001');
      expect(prog.accountLevel).toBe(1);
      expect(prog.accountXP).toBe(0);
      expect(prog.totalXPEarned).toBe(0);
      expect(prog.skillPoints).toBe(0);
      expect(prog.prestigeLevel).toBe(0);
      expect(prog.prestigeTokens).toBe(0);
      expect(prog.unlockedSkills).toEqual([]);
      expect(prog.createdAt).toBeDefined();
      expect(prog.lastUpdated).toBeDefined();
    });

    it('should accept custom initial values', () => {
      const prog = new AccountProgression({
        ...baseData,
        accountLevel: 10,
        accountXP: 500,
        totalXPEarned: 15000,
        skillPoints: 3,
        prestigeLevel: 1,
        prestigeTokens: 2,
        unlockedSkills: ['skill-a', 'skill-b']
      });

      expect(prog.accountLevel).toBe(10);
      expect(prog.accountXP).toBe(500);
      expect(prog.totalXPEarned).toBe(15000);
      expect(prog.skillPoints).toBe(3);
      expect(prog.prestigeLevel).toBe(1);
      expect(prog.prestigeTokens).toBe(2);
      expect(prog.unlockedSkills).toEqual(['skill-a', 'skill-b']);
    });
  });

  describe('getXPForNextLevel', () => {
    it('should return correct XP for level 1', () => {
      const prog = new AccountProgression(baseData);
      const xpNeeded = prog.getXPForNextLevel();

      // 1000 + (1 * 500) + Math.pow(1, 1.5) * 100 = 1000 + 500 + 100 = 1600
      expect(xpNeeded).toBe(Math.floor(1000 + 1 * 500 + Math.pow(1, 1.5) * 100));
    });

    it('should increase with level (exponential scaling)', () => {
      const prog1 = new AccountProgression({ ...baseData, accountLevel: 1 });
      const prog10 = new AccountProgression({ ...baseData, accountLevel: 10 });
      const prog50 = new AccountProgression({ ...baseData, accountLevel: 50 });

      expect(prog10.getXPForNextLevel()).toBeGreaterThan(prog1.getXPForNextLevel());
      expect(prog50.getXPForNextLevel()).toBeGreaterThan(prog10.getXPForNextLevel());
    });
  });

  describe('addXP', () => {
    it('should add XP without leveling up', () => {
      const prog = new AccountProgression(baseData);
      const result = prog.addXP(100);

      expect(result.levelsGained).toBe(0);
      expect(result.skillPointsGained).toBe(0);
      expect(result.newLevel).toBe(1);
      expect(prog.accountXP).toBe(100);
      expect(prog.totalXPEarned).toBe(100);
    });

    it('should level up when XP exceeds threshold', () => {
      const prog = new AccountProgression(baseData);
      const xpNeeded = prog.getXPForNextLevel();

      const result = prog.addXP(xpNeeded + 10);

      expect(result.levelsGained).toBe(1);
      expect(result.newLevel).toBe(2);
      expect(prog.accountLevel).toBe(2);
      expect(prog.skillPoints).toBe(1); // 1 skill point per level
    });

    it('should handle multiple level ups at once', () => {
      const prog = new AccountProgression(baseData);

      // Give massive XP to trigger multiple level ups
      const result = prog.addXP(100000);

      expect(result.levelsGained).toBeGreaterThan(1);
      expect(prog.accountLevel).toBeGreaterThan(2);
    });

    it('should grant bonus skill point every 5 levels', () => {
      const prog = new AccountProgression({ ...baseData, accountLevel: 4 });
      const xpNeeded = prog.getXPForNextLevel();

      const result = prog.addXP(xpNeeded + 1);

      // Level 4 -> 5: 1 regular + 1 bonus = 2
      expect(result.skillPointsGained).toBe(2);
      expect(prog.skillPoints).toBe(2);
    });

    it('should accumulate totalXPEarned across multiple addXP calls', () => {
      const prog = new AccountProgression(baseData);

      prog.addXP(100);
      prog.addXP(200);
      prog.addXP(300);

      expect(prog.totalXPEarned).toBe(600);
    });

    it('should update lastUpdated', () => {
      const prog = new AccountProgression({
        ...baseData,
        lastUpdated: 1000
      });

      prog.addXP(50);

      expect(prog.lastUpdated).toBeGreaterThan(1000);
    });

    it('should return current XP and xpForNext in result', () => {
      const prog = new AccountProgression(baseData);
      const result = prog.addXP(100);

      expect(result.currentXP).toBe(100);
      expect(result.xpForNext).toBe(prog.getXPForNextLevel());
    });
  });

  describe('unlockSkill', () => {
    it('should unlock a skill when enough points', () => {
      const prog = new AccountProgression({ ...baseData, skillPoints: 3 });

      const result = prog.unlockSkill('damage-boost', 1);

      expect(result).toBe(true);
      expect(prog.skillPoints).toBe(2);
      expect(prog.unlockedSkills).toContain('damage-boost');
    });

    it('should throw when not enough skill points', () => {
      const prog = new AccountProgression({ ...baseData, skillPoints: 0 });

      expect(() => prog.unlockSkill('speed-boost', 1)).toThrow('Not enough skill points');
    });

    it('should throw when skill already unlocked', () => {
      const prog = new AccountProgression({
        ...baseData,
        skillPoints: 5,
        unlockedSkills: ['damage-boost']
      });

      expect(() => prog.unlockSkill('damage-boost', 1)).toThrow('Skill already unlocked');
    });
  });

  describe('hasSkill', () => {
    it('should return true for unlocked skill', () => {
      const prog = new AccountProgression({
        ...baseData,
        unlockedSkills: ['skill-a', 'skill-b']
      });

      expect(prog.hasSkill('skill-a')).toBe(true);
    });

    it('should return false for locked skill', () => {
      const prog = new AccountProgression(baseData);

      expect(prog.hasSkill('nonexistent-skill')).toBe(false);
    });
  });

  describe('prestige', () => {
    it('should prestige at level 50 and reset progress', () => {
      const prog = new AccountProgression({
        ...baseData,
        accountLevel: 55,
        accountXP: 1000,
        skillPoints: 10,
        unlockedSkills: ['s1', 's2']
      });

      const result = prog.prestige(50);

      expect(result.success).toBe(true);
      expect(result.tokensEarned).toBeGreaterThan(0);
      expect(prog.accountLevel).toBe(1);
      expect(prog.accountXP).toBe(0);
      expect(prog.skillPoints).toBe(0);
      expect(prog.unlockedSkills).toEqual([]);
      expect(prog.prestigeLevel).toBe(1);
    });

    it('should throw when below minimum level', () => {
      const prog = new AccountProgression({ ...baseData, accountLevel: 30 });

      expect(() => prog.prestige(50)).toThrow('Must be at least level 50 to prestige');
    });

    it('should calculate tokens: 1 per 10 levels above minimum + 1', () => {
      const prog = new AccountProgression({ ...baseData, accountLevel: 70 });
      const result = prog.prestige(50);

      // (70 - 50) / 10 + 1 = 3 tokens
      expect(result.tokensEarned).toBe(3);
    });

    it('should accumulate prestige level and tokens', () => {
      const prog = new AccountProgression({
        ...baseData,
        accountLevel: 50,
        prestigeLevel: 2,
        prestigeTokens: 5
      });

      const result = prog.prestige(50);

      expect(prog.prestigeLevel).toBe(3);
      expect(prog.prestigeTokens).toBe(5 + result.tokensEarned);
    });
  });

  describe('getPrestigeBonuses', () => {
    it('should return zero bonuses at prestige level 0', () => {
      const prog = new AccountProgression(baseData);
      const bonuses = prog.getPrestigeBonuses();

      expect(bonuses.xpBonus).toBe(0);
      expect(bonuses.goldBonus).toBe(0);
      expect(bonuses.damageBonus).toBe(0);
      expect(bonuses.healthBonus).toBe(0);
      expect(bonuses.startingGold).toBe(0);
    });

    it('should scale bonuses with prestige level', () => {
      const prog = new AccountProgression({ ...baseData, prestigeLevel: 3 });
      const bonuses = prog.getPrestigeBonuses();

      expect(bonuses.xpBonus).toBeCloseTo(0.15); // 3 * 0.05
      expect(bonuses.goldBonus).toBeCloseTo(0.15); // 3 * 0.05
      expect(bonuses.damageBonus).toBeCloseTo(0.06); // 3 * 0.02
      expect(bonuses.healthBonus).toBe(30); // 3 * 10
      expect(bonuses.startingGold).toBe(150); // 3 * 50
    });
  });

  describe('getLevelProgress', () => {
    it('should return 0 for a fresh account', () => {
      const prog = new AccountProgression(baseData);

      expect(prog.getLevelProgress()).toBe(0);
    });

    it('should return percentage of XP towards next level', () => {
      const prog = new AccountProgression(baseData);
      const xpNeeded = prog.getXPForNextLevel();
      prog.accountXP = Math.floor(xpNeeded / 2);

      expect(prog.getLevelProgress()).toBe(50);
    });
  });

  describe('fromDB', () => {
    it('should reconstruct from database row', () => {
      const dbRow = {
        player_id: 'db-p-1',
        account_level: 15,
        account_xp: 800,
        total_xp_earned: 25000,
        skill_points: 4,
        prestige_level: 1,
        prestige_tokens: 2,
        unlocked_skills: JSON.stringify(['skill-x', 'skill-y']),
        created_at: 1700000000,
        last_updated: 1700005000
      };

      const prog = AccountProgression.fromDB(dbRow);

      expect(prog.playerId).toBe('db-p-1');
      expect(prog.accountLevel).toBe(15);
      expect(prog.accountXP).toBe(800);
      expect(prog.totalXPEarned).toBe(25000);
      expect(prog.skillPoints).toBe(4);
      expect(prog.prestigeLevel).toBe(1);
      expect(prog.prestigeTokens).toBe(2);
      expect(prog.unlockedSkills).toEqual(['skill-x', 'skill-y']);
      expect(prog.createdAt).toBe(1700000000 * 1000);
      expect(prog.lastUpdated).toBe(1700005000 * 1000);
    });

    it('should handle null unlocked_skills', () => {
      const dbRow = {
        player_id: 'db-p-2',
        account_level: 1,
        account_xp: 0,
        total_xp_earned: 0,
        skill_points: 0,
        prestige_level: 0,
        prestige_tokens: 0,
        unlocked_skills: null,
        created_at: 1700000000,
        last_updated: 1700000000
      };

      const prog = AccountProgression.fromDB(dbRow);

      expect(prog.unlockedSkills).toEqual([]);
    });
  });

  describe('constructor invariants', () => {
    it('should throw when playerId is missing', () => {
      expect(() => new AccountProgression({ playerId: '' })).toThrow('playerId is required');
    });

    it('should throw when accountLevel < 1', () => {
      expect(() => new AccountProgression({ playerId: 'p', accountLevel: 0 })).toThrow('accountLevel must be >= 1');
    });

    it('should throw when accountXP < 0', () => {
      expect(() => new AccountProgression({ playerId: 'p', accountXP: -1 })).toThrow('accountXP must be >= 0');
    });

    it('should throw when skillPoints < 0', () => {
      expect(() => new AccountProgression({ playerId: 'p', skillPoints: -5 })).toThrow('skillPoints must be >= 0');
    });
  });

  describe('addXP invariants', () => {
    it('should throw when xp is negative', () => {
      const prog = new AccountProgression({ playerId: 'p' });
      expect(() => prog.addXP(-10)).toThrow('xp must be a non-negative number');
    });

    it('should throw when xp is not a number', () => {
      const prog = new AccountProgression({ playerId: 'p' });
      expect(() => prog.addXP('lots')).toThrow('xp must be a non-negative number');
    });
  });

  describe('toObject', () => {
    it('should return a serializable plain object', () => {
      const prog = new AccountProgression({
        ...baseData,
        accountLevel: 5,
        accountXP: 300,
        totalXPEarned: 8000,
        skillPoints: 2,
        prestigeLevel: 0,
        prestigeTokens: 0,
        unlockedSkills: ['s1'],
        createdAt: 1000,
        lastUpdated: 2000
      });

      expect(prog.toObject()).toEqual({
        playerId: 'player-001',
        accountLevel: 5,
        accountXP: 300,
        totalXPEarned: 8000,
        skillPoints: 2,
        prestigeLevel: 0,
        prestigeTokens: 0,
        unlockedSkills: ['s1'],
        createdAt: 1000,
        lastUpdated: 2000
      });
    });
  });
});
