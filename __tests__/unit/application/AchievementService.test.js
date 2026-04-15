/**
 * Unit tests for lib/application/AchievementService.js
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const AchievementService = require('../../../lib/application/AchievementService');
const logger = require('../../../infrastructure/logging/Logger');

function makeAchievement(overrides = {}) {
  return {
    id: 'ach1',
    name: 'First Blood',
    points: 10,
    hidden: false,
    checkRequirements: jest.fn(() => true),
    toObject: jest.fn(function () {
 return { id: this.id, points: this.points, name: this.name };
}),
    ...overrides
  };
}

function makeRepos() {
  return {
    achievement: {
      getAllAchievements: jest.fn(() => Promise.resolve([])),
      getPlayerAchievements: jest.fn(() => Promise.resolve([])),
      unlockAchievement: jest.fn(() => Promise.resolve(true))
    },
    player: {
      getStats: jest.fn(() => Promise.resolve({}))
    }
  };
}

beforeEach(() => jest.clearAllMocks());

describe('checkAndUnlockAchievements', () => {
  test('returns empty array when no achievements', async () => {
    const repos = makeRepos();
    const svc = new AchievementService(repos.achievement, repos.player);
    const result = await svc.checkAndUnlockAchievements('p1');
    expect(result).toEqual([]);
  });

  test('unlocks achievement meeting requirements', async () => {
    const repos = makeRepos();
    const ach = makeAchievement();
    repos.achievement.getAllAchievements.mockResolvedValue([ach]);
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.checkAndUnlockAchievements('p1', { sessionId: 's1' });

    expect(repos.achievement.unlockAchievement).toHaveBeenCalledWith('p1', 'ach1', 's1');
    expect(result).toEqual([ach]);
    expect(logger.info).toHaveBeenCalled();
  });

  test('skips already-unlocked achievements', async () => {
    const repos = makeRepos();
    const ach = makeAchievement();
    repos.achievement.getAllAchievements.mockResolvedValue([ach]);
    repos.achievement.getPlayerAchievements.mockResolvedValue([{ achievementId: 'ach1' }]);
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.checkAndUnlockAchievements('p1');

    expect(repos.achievement.unlockAchievement).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('skips achievements not meeting requirements', async () => {
    const repos = makeRepos();
    const ach = makeAchievement({ checkRequirements: jest.fn(() => false) });
    repos.achievement.getAllAchievements.mockResolvedValue([ach]);
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.checkAndUnlockAchievements('p1');

    expect(ach.checkRequirements).toHaveBeenCalledWith({});
    expect(repos.achievement.unlockAchievement).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('skips when unlockAchievement returns false (already unlocked race)', async () => {
    const repos = makeRepos();
    repos.achievement.getAllAchievements.mockResolvedValue([makeAchievement()]);
    repos.achievement.unlockAchievement.mockResolvedValue(false);
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.checkAndUnlockAchievements('p1');
    expect(result).toEqual([]);
  });

  test('returns empty array and logs on repository error', async () => {
    const repos = makeRepos();
    repos.achievement.getAllAchievements.mockRejectedValue(new Error('DB down'));
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.checkAndUnlockAchievements('p1');
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('Failed to check achievements', expect.objectContaining({
      playerId: 'p1',
      error: 'DB down'
    }));
  });

  test('processes multiple achievements in single call', async () => {
    const repos = makeRepos();
    const a1 = makeAchievement({ id: 'a1', name: 'First' });
    const a2 = makeAchievement({ id: 'a2', name: 'Second' });
    repos.achievement.getAllAchievements.mockResolvedValue([a1, a2]);
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.checkAndUnlockAchievements('p1');
    expect(result).toHaveLength(2);
    expect(repos.achievement.unlockAchievement).toHaveBeenCalledTimes(2);
  });
});

describe('getPlayerAchievementProgress', () => {
  test('computes full progress snapshot', async () => {
    const repos = makeRepos();
    const a1 = makeAchievement({ id: 'a1', points: 10 });
    const a2 = makeAchievement({ id: 'a2', points: 20 });
    const a3 = makeAchievement({ id: 'a3', points: 30, hidden: true });
    repos.achievement.getAllAchievements.mockResolvedValue([a1, a2, a3]);
    repos.achievement.getPlayerAchievements.mockResolvedValue([
      { achievementId: 'a1', points: 10 }
    ]);
    const svc = new AchievementService(repos.achievement, repos.player);

    const result = await svc.getPlayerAchievementProgress('p1');

    expect(result.unlocked).toHaveLength(1);
    expect(result.locked).toHaveLength(1); // a2 visible, a3 hidden excluded
    expect(result.totalPoints).toBe(10);
    expect(result.maxPoints).toBe(60);
    expect(result.percentComplete).toBe(17); // Math.round(10/60*100)
    expect(result.unlockedCount).toBe(1);
    expect(result.totalCount).toBe(3);
  });

  test('handles zero achievements without division by zero', async () => {
    const repos = makeRepos();
    const svc = new AchievementService(repos.achievement, repos.player);
    const result = await svc.getPlayerAchievementProgress('p1');
    expect(result.percentComplete).toBe(0);
    expect(result.totalPoints).toBe(0);
    expect(result.maxPoints).toBe(0);
  });

  test('rethrows on repository error with log', async () => {
    const repos = makeRepos();
    repos.achievement.getAllAchievements.mockRejectedValue(new Error('DB error'));
    const svc = new AchievementService(repos.achievement, repos.player);

    await expect(svc.getPlayerAchievementProgress('p1')).rejects.toThrow('DB error');
    expect(logger.error).toHaveBeenCalledWith('Failed to get achievement progress', expect.objectContaining({
      playerId: 'p1',
      error: 'DB error'
    }));
  });
});
