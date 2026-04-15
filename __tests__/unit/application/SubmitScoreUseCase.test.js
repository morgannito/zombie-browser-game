/**
 * SUBMIT SCORE USE CASE - Unit Tests
 * Tests leaderboard score submission with mocked repositories
 */

const SubmitScoreUseCase = require("../../../contexts/leaderboard/SubmitScoreUseCase");

// Mock Logger
jest.mock('../../../lib/infrastructure/Logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('SubmitScoreUseCase', () => {
  let useCase;
  let mockLeaderboardRepository;
  let mockPlayerRepository;

  const existingPlayer = {
    id: 'player-001',
    username: 'ScorePlayer'
  };

  beforeEach(() => {
    mockLeaderboardRepository = {
      submit: jest.fn().mockResolvedValue(undefined),
      getTop: jest.fn(),
      getByPlayer: jest.fn()
    };

    mockPlayerRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };

    useCase = new SubmitScoreUseCase(mockLeaderboardRepository, mockPlayerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - valid submission', () => {
    it('should submit a valid score and return a LeaderboardEntry', async () => {
      mockPlayerRepository.findById.mockResolvedValue(existingPlayer);

      const entry = await useCase.execute({
        playerId: 'player-001',
        wave: 10,
        level: 15,
        kills: 200,
        survivalTime: 600
      });

      expect(entry).toBeDefined();
      expect(entry.playerId).toBe('player-001');
      expect(entry.playerUsername).toBe('ScorePlayer');
      expect(entry.wave).toBe(10);
      expect(entry.level).toBe(15);
      expect(entry.kills).toBe(200);
      expect(entry.survivalTime).toBe(600);
      expect(entry.score).toBeGreaterThan(0);
    });

    it('should calculate score using LeaderboardEntry.calculateScore', async () => {
      mockPlayerRepository.findById.mockResolvedValue(existingPlayer);

      const entry = await useCase.execute({
        playerId: 'player-001',
        wave: 5,
        level: 10,
        kills: 50,
        survivalTime: 120
      });

      // wave*100 + level*50 + kills*10 + floor(120/60)*5
      const expectedScore = 5 * 100 + 10 * 50 + 50 * 10 + Math.floor(120 / 60) * 5;
      expect(entry.score).toBe(expectedScore);
    });

    it('should call leaderboardRepository.submit with the entry', async () => {
      mockPlayerRepository.findById.mockResolvedValue(existingPlayer);

      await useCase.execute({
        playerId: 'player-001',
        wave: 3,
        level: 5,
        kills: 30,
        survivalTime: 90
      });

      expect(mockLeaderboardRepository.submit).toHaveBeenCalledTimes(1);
      const submittedEntry = mockLeaderboardRepository.submit.mock.calls[0][0];
      expect(submittedEntry.playerId).toBe('player-001');
      expect(submittedEntry.wave).toBe(3);
    });

    it('should call playerRepository.findById to resolve username', async () => {
      mockPlayerRepository.findById.mockResolvedValue(existingPlayer);

      await useCase.execute({
        playerId: 'player-001',
        wave: 1,
        level: 1,
        kills: 1,
        survivalTime: 10
      });

      expect(mockPlayerRepository.findById).toHaveBeenCalledWith('player-001');
    });
  });

  describe('execute - validation: invalid data', () => {
    it('should throw when playerId is missing', async () => {
      await expect(
        useCase.execute({
          playerId: null,
          wave: 1,
          level: 1,
          kills: 1,
          survivalTime: 10
        })
      ).rejects.toThrow('Invalid score data');
    });

    it('should throw when wave is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-001',
          wave: -1,
          level: 1,
          kills: 1,
          survivalTime: 10
        })
      ).rejects.toThrow('Invalid score data');
    });

    it('should throw when level is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-001',
          wave: 1,
          level: -1,
          kills: 1,
          survivalTime: 10
        })
      ).rejects.toThrow('Invalid score data');
    });

    it('should throw when kills is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-001',
          wave: 1,
          level: 1,
          kills: -5,
          survivalTime: 10
        })
      ).rejects.toThrow('Invalid score data');
    });

    it('should throw when survivalTime is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-001',
          wave: 1,
          level: 1,
          kills: 1,
          survivalTime: -10
        })
      ).rejects.toThrow('Invalid score data');
    });

    it('should not call any repository on invalid data', async () => {
      try {
        await useCase.execute({
          playerId: null,
          wave: -1,
          level: -1,
          kills: -1,
          survivalTime: -1
        });
      } catch {
        // expected
      }

      expect(mockPlayerRepository.findById).not.toHaveBeenCalled();
      expect(mockLeaderboardRepository.submit).not.toHaveBeenCalled();
    });
  });

  describe('execute - validation: player not found', () => {
    it('should throw when player does not exist', async () => {
      mockPlayerRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          playerId: 'nonexistent',
          wave: 5,
          level: 5,
          kills: 50,
          survivalTime: 120
        })
      ).rejects.toThrow("Player with identifier 'nonexistent' not found");
    });

    it('should not submit to leaderboard when player not found', async () => {
      mockPlayerRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute({
          playerId: 'ghost',
          wave: 1,
          level: 1,
          kills: 1,
          survivalTime: 10
        });
      } catch {
        // expected
      }

      expect(mockLeaderboardRepository.submit).not.toHaveBeenCalled();
    });
  });

  describe('execute - edge cases', () => {
    it('should accept zero values for all numeric fields', async () => {
      mockPlayerRepository.findById.mockResolvedValue(existingPlayer);

      const entry = await useCase.execute({
        playerId: 'player-001',
        wave: 0,
        level: 0,
        kills: 0,
        survivalTime: 0
      });

      expect(entry.score).toBe(0);
    });
  });
});
