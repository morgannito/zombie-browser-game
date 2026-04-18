/**
 * Tests for AccountProgressionService improvements:
 * - Skill bonus cache integration
 * - Double level-up prevention (xp lock)
 * - Cache invalidation on level-up / skill unlock
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

jest.mock('../../../lib/server/SkillBonusCache');

const AccountProgressionService = require('../../../lib/application/AccountProgressionService');
const logger = require('../../../infrastructure/logging/Logger');

function makeRepo(progression = null) {
  return {
    findByPlayerId: jest.fn().mockResolvedValue(progression),
    getSkillsByIds: jest.fn().mockResolvedValue([])
  };
}

function makeCache(hit = null) {
  return { get: jest.fn().mockReturnValue(hit), set: jest.fn(), invalidate: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('AccountProgressionService - cache', () => {
  test('getPlayerSkillBonuses_cacheMiss_callsRepo', async () => {
    const repo = makeRepo();
    const svc = new AccountProgressionService(repo, makeCache(null));
    await svc.getPlayerSkillBonuses('p1');
    expect(repo.findByPlayerId).toHaveBeenCalledWith('p1');
  });

  test('getPlayerSkillBonuses_cacheHit_skipsRepo', async () => {
    const repo = makeRepo();
    const hit = { damageMultiplier: 0.5 };
    const svc = new AccountProgressionService(repo, makeCache(hit));
    const result = await svc.getPlayerSkillBonuses('p1');
    expect(repo.findByPlayerId).not.toHaveBeenCalled();
    expect(result.damageMultiplier).toBe(0.5);
  });

  test('getPlayerSkillBonuses_cacheMiss_storesBonuses', async () => {
    const repo = makeRepo({ unlockedSkills: [], getPrestigeBonuses: () => ({}) });
    const cache = makeCache(null);
    const svc = new AccountProgressionService(repo, cache);
    await svc.getPlayerSkillBonuses('p1');
    expect(cache.set).toHaveBeenCalledWith('p1', expect.any(Object));
  });
});

describe('AccountProgressionService - double level-up prevention', () => {
  test('concurrent_calls_secondSkipped_logsWarn', async () => {
    let resolveFirst;
    mockExecute.mockReturnValueOnce(new Promise(r => {
 resolveFirst = r;
}));
    mockExecute.mockResolvedValue({ levelsGained: 0, newLevel: 1 });
    const svc = new AccountProgressionService(makeRepo(), makeCache(null));

    const p1 = svc.handlePlayerDeath({ kills: 0 }, 'p1');
    const p2 = svc.handlePlayerDeath({ kills: 0 }, 'p1');

    resolveFirst({ levelsGained: 1, newLevel: 2 });
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r2).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'XP grant skipped: concurrent request',
      expect.objectContaining({ playerId: 'p1' })
    );
    expect(r1.levelsGained).toBe(1);
  });

  test('sequential_calls_bothSucceed', async () => {
    mockExecute.mockResolvedValue({ levelsGained: 0, newLevel: 1 });
    const svc = new AccountProgressionService(makeRepo(), makeCache(null));

    const r1 = await svc.handlePlayerDeath({}, 'p1');
    const r2 = await svc.handlePlayerDeath({}, 'p1');

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });

  test('lock_released_afterError', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    mockExecute.mockResolvedValue({ levelsGained: 0, newLevel: 1 });
    const svc = new AccountProgressionService(makeRepo(), makeCache(null));

    await svc.handlePlayerDeath({}, 'p1'); // fails, lock must be released
    const r2 = await svc.handlePlayerDeath({}, 'p1');

    expect(r2).not.toBeNull();
  });
});

describe('AccountProgressionService - cache invalidation on level-up', () => {
  test('levelUp_invalidatesCache', async () => {
    mockExecute.mockResolvedValue({ levelsGained: 1, newLevel: 2 });
    const cache = makeCache(null);
    const svc = new AccountProgressionService(makeRepo(), cache);

    await svc.handlePlayerDeath({}, 'p1');

    expect(cache.invalidate).toHaveBeenCalledWith('p1');
  });

  test('noLevelUp_doesNotInvalidateCache', async () => {
    mockExecute.mockResolvedValue({ levelsGained: 0, newLevel: 1 });
    const cache = makeCache(null);
    const svc = new AccountProgressionService(makeRepo(), cache);

    await svc.handlePlayerDeath({}, 'p1');

    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  test('invalidateBonusCache_delegatesToCache', () => {
    const cache = makeCache(null);
    const svc = new AccountProgressionService(makeRepo(), cache);
    svc.invalidateBonusCache('p1');
    expect(cache.invalidate).toHaveBeenCalledWith('p1');
  });
});
