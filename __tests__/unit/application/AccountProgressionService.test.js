/**
 * Unit tests for lib/application/AccountProgressionService.js
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const mockExecute = jest.fn();
const mockCalculateXP = jest.fn(() => 100);
jest.mock('../../../lib/application/use-cases/AddAccountXPUseCase', () => {
  const ctor = jest.fn(function () {
    this.execute = mockExecute;
  });
  ctor.calculateXPFromGameStats = mockCalculateXP;
  return ctor;
});

const AccountProgressionService = require('../../../lib/application/AccountProgressionService');
const logger = require('../../../infrastructure/logging/Logger');

function makeRepo() {
  return {
    findByPlayerId: jest.fn(),
    getSkillsByIds: jest.fn(() => Promise.resolve([]))
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalculateXP.mockReturnValue(100);
});

describe('handlePlayerDeath', () => {
  test('computes stats, awards XP, returns result', async () => {
    const repo = makeRepo();
    mockExecute.mockResolvedValue({ levelsGained: 1, newLevel: 5 });
    const svc = new AccountProgressionService(repo);
    const player = { kills: 10, zombiesKilled: 15, wave: 3, level: 2, survivalTime: 600 };

    const result = await svc.handlePlayerDeath(player, 'p1');

    expect(mockCalculateXP).toHaveBeenCalledWith(expect.objectContaining({
      kills: 10, zombiesKilled: 15, wave: 3, level: 2, survivalTimeSeconds: 600
    }));
    expect(mockExecute).toHaveBeenCalledWith({
      playerId: 'p1',
      xpEarned: 100,
      gameStats: expect.any(Object)
    });
    expect(result).toEqual({ levelsGained: 1, newLevel: 5 });
    expect(logger.info).toHaveBeenCalled();
  });

  test('applies defaults for missing player fields', async () => {
    const repo = makeRepo();
    mockExecute.mockResolvedValue({});
    const svc = new AccountProgressionService(repo);
    await svc.handlePlayerDeath({}, 'p1');
    expect(mockCalculateXP).toHaveBeenCalledWith({
      kills: 0, zombiesKilled: 0, wave: 1, level: 1, survivalTimeSeconds: 0,
      bossKills: 0, comboMax: 0, score: 0, goldEarned: 0
    });
  });

  test('returns null and logs on use-case error (does not throw)', async () => {
    const repo = makeRepo();
    mockExecute.mockRejectedValue(new Error('XP failed'));
    const svc = new AccountProgressionService(repo);
    const result = await svc.handlePlayerDeath({}, 'p1');
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Failed to handle player death', expect.objectContaining({
      playerId: 'p1', error: 'XP failed'
    }));
  });
});

describe('getPlayerSkillBonuses', () => {
  test('returns default bonuses when no progression found', async () => {
    const repo = makeRepo();
    repo.findByPlayerId.mockResolvedValue(null);
    const svc = new AccountProgressionService(repo);
    const bonuses = await svc.getPlayerSkillBonuses('p1');
    expect(bonuses).toEqual(svc.getDefaultBonuses());
  });

  test('returns defaults when progression has no unlocked skills', async () => {
    const repo = makeRepo();
    repo.findByPlayerId.mockResolvedValue({
      unlockedSkills: [],
      getPrestigeBonuses: () => ({})
    });
    const svc = new AccountProgressionService(repo);
    const bonuses = await svc.getPlayerSkillBonuses('p1');
    expect(bonuses.xpMultiplier).toBe(0);
    expect(repo.getSkillsByIds).not.toHaveBeenCalled();
  });

  test('aggregates skill effects and applies prestige bonuses', async () => {
    const repo = makeRepo();
    repo.findByPlayerId.mockResolvedValue({
      unlockedSkills: ['s1', 's2'],
      getPrestigeBonuses: () => ({
        xpBonus: 0.1, goldBonus: 0.2, damageBonus: 0.05,
        healthBonus: 50, startingGold: 100
      })
    });
    repo.getSkillsByIds.mockResolvedValue([
      { effects: { damageMultiplier: 0.15, critChance: 0.1 } },
      { effects: { damageMultiplier: 0.05, explosiveRounds: true } }
    ]);
    const svc = new AccountProgressionService(repo);

    const bonuses = await svc.getPlayerSkillBonuses('p1');

    expect(bonuses.damageMultiplier).toBeCloseTo(0.2 + 0.05); // sum + prestige
    expect(bonuses.critChance).toBeCloseTo(0.1);
    expect(bonuses.explosiveRounds).toBe(true);
    expect(bonuses.xpMultiplier).toBeCloseTo(1.1); // (0 || 1.0) + 0.1 prestige
    expect(bonuses.startingGold).toBe(100);
    expect(bonuses.maxHealthBonus).toBe(50);
  });

  test('skips skills without effects object', async () => {
    const repo = makeRepo();
    repo.findByPlayerId.mockResolvedValue({
      unlockedSkills: ['s1'],
      getPrestigeBonuses: () => ({})
    });
    repo.getSkillsByIds.mockResolvedValue([null, { effects: null }, { effects: { critChance: 0.05 } }]);
    const svc = new AccountProgressionService(repo);
    const bonuses = await svc.getPlayerSkillBonuses('p1');
    expect(bonuses.critChance).toBeCloseTo(0.05);
  });

  test('returns defaults on repo error', async () => {
    const repo = makeRepo();
    repo.findByPlayerId.mockRejectedValue(new Error('DB down'));
    const svc = new AccountProgressionService(repo);
    const bonuses = await svc.getPlayerSkillBonuses('p1');
    expect(bonuses).toEqual(svc.getDefaultBonuses());
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('getDefaultBonuses', () => {
  test('returns complete bonus skeleton', () => {
    const svc = new AccountProgressionService(makeRepo());
    const d = svc.getDefaultBonuses();
    expect(d).toEqual(expect.objectContaining({
      damageMultiplier: 0, xpMultiplier: 0, goldMultiplier: 0,
      maxHealthBonus: 0, startingGold: 0,
      critChance: 0, critMultiplier: 1.0,
      explosiveRounds: false, secondChance: false,
      berserkerThreshold: 0.3, immunityCooldown: 15000
    }));
  });
});
