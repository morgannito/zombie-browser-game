/**
 * CREATE PLAYER USE CASE TESTS
 * TDD approach: Test application layer with mocked repository
 */

const CreatePlayerUseCase = require('../../application/use-cases/CreatePlayerUseCase');
const Player = require('../../domain/entities/Player');

describe('CreatePlayerUseCase - Application Logic', () => {
  let mockPlayerRepository;
  let useCase;

  beforeEach(() => {
    // Mock repository
    mockPlayerRepository = {
      findByUsername: jest.fn(),
      create: jest.fn()
    };

    useCase = new CreatePlayerUseCase(mockPlayerRepository);
  });

  describe('execute()', () => {
    it('should create player successfully with valid data', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue();

      const result = await useCase.execute({
        id: 'player-123',
        username: 'TestPlayer'
      });

      expect(result).toBeInstanceOf(Player);
      expect(result.id).toBe('player-123');
      expect(result.username).toBe('TestPlayer');
      expect(mockPlayerRepository.findByUsername).toHaveBeenCalledWith('TestPlayer');
      expect(mockPlayerRepository.create).toHaveBeenCalledWith(expect.any(Player));
    });

    it('should throw error when id is missing', async () => {
      await expect(
        useCase.execute({ username: 'TestPlayer' })
      ).rejects.toThrow('ID and username are required');

      expect(mockPlayerRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockPlayerRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when username is missing', async () => {
      await expect(
        useCase.execute({ id: 'player-123' })
      ).rejects.toThrow('ID and username are required');

      expect(mockPlayerRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockPlayerRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when username is too short', async () => {
      await expect(
        useCase.execute({ id: 'player-123', username: 'A' })
      ).rejects.toThrow('Username must be between 2 and 20 characters');

      expect(mockPlayerRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should throw error when username is too long', async () => {
      const longUsername = 'A'.repeat(21);

      await expect(
        useCase.execute({ id: 'player-123', username: longUsername })
      ).rejects.toThrow('Username must be between 2 and 20 characters');

      expect(mockPlayerRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should accept username exactly 2 characters', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue();

      const result = await useCase.execute({
        id: 'player-123',
        username: 'AB'
      });

      expect(result.username).toBe('AB');
      expect(mockPlayerRepository.create).toHaveBeenCalled();
    });

    it('should accept username exactly 20 characters', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue();

      const username = 'A'.repeat(20);
      const result = await useCase.execute({
        id: 'player-123',
        username
      });

      expect(result.username).toBe(username);
      expect(mockPlayerRepository.create).toHaveBeenCalled();
    });

    it('should throw error when username already exists', async () => {
      const existingPlayer = new Player({
        id: 'other-id',
        username: 'TestPlayer'
      });
      mockPlayerRepository.findByUsername.mockResolvedValue(existingPlayer);

      await expect(
        useCase.execute({ id: 'player-123', username: 'TestPlayer' })
      ).rejects.toThrow('Username already taken');

      expect(mockPlayerRepository.findByUsername).toHaveBeenCalledWith('TestPlayer');
      expect(mockPlayerRepository.create).not.toHaveBeenCalled();
    });

    it('should create player with default stats', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue();

      const result = await useCase.execute({
        id: 'player-123',
        username: 'NewPlayer'
      });

      expect(result.totalKills).toBe(0);
      expect(result.totalDeaths).toBe(0);
      expect(result.highestWave).toBe(0);
      expect(result.highestLevel).toBe(0);
      expect(result.totalPlaytime).toBe(0);
      expect(result.totalGoldEarned).toBe(0);
    });

    it('should call repository create with Player instance', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue();

      await useCase.execute({
        id: 'player-123',
        username: 'TestPlayer'
      });

      expect(mockPlayerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player-123',
          username: 'TestPlayer'
        })
      );
    });

    it('should propagate repository errors', async () => {
      mockPlayerRepository.findByUsername.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        useCase.execute({ id: 'player-123', username: 'TestPlayer' })
      ).rejects.toThrow('Database connection failed');
    });
  });
});
