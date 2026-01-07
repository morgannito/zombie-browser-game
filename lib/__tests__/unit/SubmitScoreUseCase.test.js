/**
 * SUBMIT SCORE USE CASE TESTS
 * TDD approach: Test leaderboard submission with mocked repositories
 */

const SubmitScoreUseCase = require('../../application/use-cases/SubmitScoreUseCase');
const LeaderboardEntry = require('../../domain/entities/LeaderboardEntry');
const Player = require('../../domain/entities/Player');

describe('SubmitScoreUseCase - Application Logic', () => {
  let mockLeaderboardRepository;
  let mockPlayerRepository;
  let useCase;

  beforeEach(() => {
    mockLeaderboardRepository = {
      submit: jest.fn()
    };

    mockPlayerRepository = {
      findById: jest.fn()
    };

    useCase = new SubmitScoreUseCase(mockLeaderboardRepository, mockPlayerRepository);
  });

  describe('execute()', () => {
    it('should submit score successfully with valid data', async () => {
      const player = new Player({ id: 'player-123', username: 'TestPlayer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      const result = await useCase.execute({
        playerId: 'player-123',
        wave: 10,
        level: 20,
        kills: 50,
        survivalTime: 600
      });

      expect(result).toBeInstanceOf(LeaderboardEntry);
      expect(result.playerId).toBe('player-123');
      expect(result.playerUsername).toBe('TestPlayer');
      expect(result.wave).toBe(10);
      expect(result.level).toBe(20);
      expect(result.kills).toBe(50);
      expect(result.survivalTime).toBe(600);
      expect(mockPlayerRepository.findById).toHaveBeenCalledWith('player-123');
      expect(mockLeaderboardRepository.submit).toHaveBeenCalledWith(expect.any(LeaderboardEntry));
    });

    it('should calculate score correctly', async () => {
      const player = new Player({ id: 'player-123', username: 'TestPlayer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      const result = await useCase.execute({
        playerId: 'player-123',
        wave: 10,       // 10 * 100 = 1000
        level: 20,      // 20 * 50 = 1000
        kills: 50,      // 50 * 10 = 500
        survivalTime: 600 // 10 minutes * 5 = 50
      });

      // Total: 1000 + 1000 + 500 + 50 = 2550
      expect(result.score).toBe(2550);
    });

    it('should throw error when playerId is missing', async () => {
      await expect(
        useCase.execute({
          wave: 10,
          level: 20,
          kills: 50,
          survivalTime: 600
        })
      ).rejects.toThrow('Invalid score data');

      expect(mockPlayerRepository.findById).not.toHaveBeenCalled();
      expect(mockLeaderboardRepository.submit).not.toHaveBeenCalled();
    });

    it('should throw error when wave is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-123',
          wave: -1,
          level: 20,
          kills: 50,
          survivalTime: 600
        })
      ).rejects.toThrow('Invalid score data');

      expect(mockPlayerRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error when level is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-123',
          wave: 10,
          level: -1,
          kills: 50,
          survivalTime: 600
        })
      ).rejects.toThrow('Invalid score data');

      expect(mockPlayerRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error when kills is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-123',
          wave: 10,
          level: 20,
          kills: -1,
          survivalTime: 600
        })
      ).rejects.toThrow('Invalid score data');

      expect(mockPlayerRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error when survivalTime is negative', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-123',
          wave: 10,
          level: 20,
          kills: 50,
          survivalTime: -1
        })
      ).rejects.toThrow('Invalid score data');

      expect(mockPlayerRepository.findById).not.toHaveBeenCalled();
    });

    it('should accept zero values', async () => {
      const player = new Player({ id: 'player-123', username: 'TestPlayer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      const result = await useCase.execute({
        playerId: 'player-123',
        wave: 0,
        level: 0,
        kills: 0,
        survivalTime: 0
      });

      expect(result.score).toBe(0);
      expect(mockLeaderboardRepository.submit).toHaveBeenCalled();
    });

    it('should throw error when player not found', async () => {
      mockPlayerRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          playerId: 'non-existent',
          wave: 10,
          level: 20,
          kills: 50,
          survivalTime: 600
        })
      ).rejects.toThrow('Player non-existent not found');

      expect(mockPlayerRepository.findById).toHaveBeenCalledWith('non-existent');
      expect(mockLeaderboardRepository.submit).not.toHaveBeenCalled();
    });

    it('should include player username in entry', async () => {
      const player = new Player({ id: 'player-123', username: 'ProGamer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      const result = await useCase.execute({
        playerId: 'player-123',
        wave: 10,
        level: 20,
        kills: 50,
        survivalTime: 600
      });

      expect(result.playerUsername).toBe('ProGamer');
    });

    it('should call leaderboard repository submit with entry', async () => {
      const player = new Player({ id: 'player-123', username: 'TestPlayer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      await useCase.execute({
        playerId: 'player-123',
        wave: 10,
        level: 20,
        kills: 50,
        survivalTime: 600
      });

      expect(mockLeaderboardRepository.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-123',
          playerUsername: 'TestPlayer',
          wave: 10,
          level: 20,
          kills: 50,
          survivalTime: 600
        })
      );
    });

    it('should propagate player repository errors', async () => {
      mockPlayerRepository.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        useCase.execute({
          playerId: 'player-123',
          wave: 10,
          level: 20,
          kills: 50,
          survivalTime: 600
        })
      ).rejects.toThrow('Database connection failed');

      expect(mockLeaderboardRepository.submit).not.toHaveBeenCalled();
    });

    it('should propagate leaderboard repository errors', async () => {
      const player = new Player({ id: 'player-123', username: 'TestPlayer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockRejectedValue(
        new Error('Leaderboard full')
      );

      await expect(
        useCase.execute({
          playerId: 'player-123',
          wave: 10,
          level: 20,
          kills: 50,
          survivalTime: 600
        })
      ).rejects.toThrow('Leaderboard full');
    });

    it('should handle high scores correctly', async () => {
      const player = new Player({ id: 'player-123', username: 'Legend' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      const result = await useCase.execute({
        playerId: 'player-123',
        wave: 100,
        level: 200,
        kills: 5000,
        survivalTime: 7200 // 120 minutes
      });

      // 100*100 + 200*50 + 5000*10 + 120*5 = 10000 + 10000 + 50000 + 600 = 70600
      expect(result.score).toBe(70600);
    });

    it('should set createdAt timestamp on entry', async () => {
      const player = new Player({ id: 'player-123', username: 'TestPlayer' });
      mockPlayerRepository.findById.mockResolvedValue(player);
      mockLeaderboardRepository.submit.mockResolvedValue();

      const before = Date.now();
      const result = await useCase.execute({
        playerId: 'player-123',
        wave: 10,
        level: 20,
        kills: 50,
        survivalTime: 600
      });
      const after = Date.now();

      expect(result.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.createdAt).toBeLessThanOrEqual(after);
    });
  });
});
