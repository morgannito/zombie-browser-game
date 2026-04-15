/**
 * GET LEADERBOARD USE CASE - Unit Tests
 */

const GetLeaderboardUseCase = require('../../../contexts/leaderboard/GetLeaderboardUseCase');

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

function makeEntry(overrides = {}) {
  const entry = {
    playerId: 'p1', username: 'test', score: 100, wave: 5,
    ...overrides
  };
  entry.toObject = () => ({ ...entry });
  return entry;
}

describe('GetLeaderboardUseCase', () => {
  let useCase;
  let mockRepo;

  beforeEach(() => {
    mockRepo = {
      getTop: jest.fn().mockResolvedValue([]),
      getByPlayer: jest.fn().mockResolvedValue([]),
      getBestForPlayer: jest.fn().mockResolvedValue(null),
      getPlayerRank: jest.fn().mockResolvedValue(null)
    };
    useCase = new GetLeaderboardUseCase(mockRepo);
  });

  describe('global path (no playerId)', () => {
    test('defaults limit to 10 when options omitted', async () => {
      await useCase.execute();
      expect(mockRepo.getTop).toHaveBeenCalledWith(10);
    });

    test('respects custom limit', async () => {
      await useCase.execute({ limit: 25 });
      expect(mockRepo.getTop).toHaveBeenCalledWith(25);
    });

    test('maps entries via toObject()', async () => {
      const e1 = makeEntry({ playerId: 'a', score: 500 });
      const e2 = makeEntry({ playerId: 'b', score: 300 });
      mockRepo.getTop.mockResolvedValue([e1, e2]);

      const result = await useCase.execute();
      expect(result.entries).toEqual([
        expect.objectContaining({ playerId: 'a', score: 500 }),
        expect.objectContaining({ playerId: 'b', score: 300 })
      ]);
      expect(result.playerRank).toBeNull();
      expect(result.playerBest).toBeNull();
    });

    test('does not call player-specific queries', async () => {
      await useCase.execute();
      expect(mockRepo.getByPlayer).not.toHaveBeenCalled();
      expect(mockRepo.getBestForPlayer).not.toHaveBeenCalled();
      expect(mockRepo.getPlayerRank).not.toHaveBeenCalled();
    });
  });

  describe('player-specific path', () => {
    test('uses getByPlayer instead of getTop', async () => {
      await useCase.execute({ playerId: 'p1' });
      expect(mockRepo.getByPlayer).toHaveBeenCalledWith('p1', 10);
      expect(mockRepo.getTop).not.toHaveBeenCalled();
    });

    test('fetches playerBest and playerRank', async () => {
      const best = makeEntry({ playerId: 'p1', score: 999 });
      mockRepo.getBestForPlayer.mockResolvedValue(best);
      mockRepo.getPlayerRank.mockResolvedValue(7);

      const result = await useCase.execute({ playerId: 'p1' });
      expect(result.playerBest).toEqual(expect.objectContaining({ score: 999 }));
      expect(result.playerRank).toBe(7);
    });

    test('returns null playerBest when repo has none', async () => {
      mockRepo.getBestForPlayer.mockResolvedValue(null);
      const result = await useCase.execute({ playerId: 'p1' });
      expect(result.playerBest).toBeNull();
    });

    test('uses custom limit for player query', async () => {
      await useCase.execute({ playerId: 'p1', limit: 5 });
      expect(mockRepo.getByPlayer).toHaveBeenCalledWith('p1', 5);
    });
  });

  test('propagates repository errors', async () => {
    mockRepo.getTop.mockRejectedValue(new Error('db down'));
    await expect(useCase.execute()).rejects.toThrow('db down');
  });
});
