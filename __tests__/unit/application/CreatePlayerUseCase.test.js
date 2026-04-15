/**
 * CREATE PLAYER USE CASE - Unit Tests
 * Tests application layer orchestration with mocked repositories
 */

const CreatePlayerUseCase = require('../../../lib/application/use-cases/CreatePlayerUseCase');

// Mock the Logger to prevent actual logging during tests
jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('CreatePlayerUseCase', () => {
  let useCase;
  let mockPlayerRepository;

  beforeEach(() => {
    mockPlayerRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };

    useCase = new CreatePlayerUseCase(mockPlayerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - valid creation', () => {
    it('should create a player with valid id and username', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue(undefined);

      const player = await useCase.execute({
        id: 'player-new',
        username: 'ValidUser'
      });

      expect(player).toBeDefined();
      expect(player.id).toBe('player-new');
      expect(player.username).toBe('ValidUser');
      expect(player.totalKills).toBe(0);
      expect(player.totalDeaths).toBe(0);
    });

    it('should call findByUsername to check uniqueness', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue(undefined);

      await useCase.execute({ id: 'p-1', username: 'UniqueUser' });

      expect(mockPlayerRepository.findByUsername).toHaveBeenCalledWith('UniqueUser');
      expect(mockPlayerRepository.findByUsername).toHaveBeenCalledTimes(1);
    });

    it('should call create on the repository', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue(undefined);

      await useCase.execute({ id: 'p-2', username: 'NewPlayer' });

      expect(mockPlayerRepository.create).toHaveBeenCalledTimes(1);
      const createdPlayer = mockPlayerRepository.create.mock.calls[0][0];
      expect(createdPlayer.id).toBe('p-2');
      expect(createdPlayer.username).toBe('NewPlayer');
    });

    it('should accept a username with exactly 2 characters', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue(undefined);

      const player = await useCase.execute({ id: 'p-3', username: 'AB' });

      expect(player.username).toBe('AB');
    });

    it('should accept a username with exactly 20 characters', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue(null);
      mockPlayerRepository.create.mockResolvedValue(undefined);

      const longName = 'A'.repeat(20);
      const player = await useCase.execute({ id: 'p-4', username: longName });

      expect(player.username).toBe(longName);
    });
  });

  describe('execute - validation: missing fields', () => {
    it('should throw when id is missing', async () => {
      await expect(useCase.execute({ id: null, username: 'User' })).rejects.toThrow(
        'ID and username are required'
      );
    });

    it('should throw when username is missing', async () => {
      await expect(useCase.execute({ id: 'p-1', username: '' })).rejects.toThrow(
        'ID and username are required'
      );
    });

    it('should throw when both id and username are missing', async () => {
      await expect(useCase.execute({ id: undefined, username: undefined })).rejects.toThrow(
        'ID and username are required'
      );
    });

    it('should not call repository when validation fails', async () => {
      try {
        await useCase.execute({ id: null, username: null });
      } catch {
        // expected
      }

      expect(mockPlayerRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockPlayerRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('execute - validation: username length', () => {
    it('should throw when username is too short (1 char)', async () => {
      await expect(useCase.execute({ id: 'p-1', username: 'A' })).rejects.toThrow(
        'Username must be between 2 and 20 characters'
      );
    });

    it('should throw when username is too long (21 chars)', async () => {
      const longName = 'A'.repeat(21);

      await expect(useCase.execute({ id: 'p-1', username: longName })).rejects.toThrow(
        'Username must be between 2 and 20 characters'
      );
    });
  });

  describe('execute - validation: username uniqueness', () => {
    it('should throw when username already exists', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue({
        id: 'existing-player',
        username: 'TakenName'
      });

      await expect(useCase.execute({ id: 'p-new', username: 'TakenName' })).rejects.toThrow(
        'Username already taken'
      );
    });

    it('should not call create when username exists', async () => {
      mockPlayerRepository.findByUsername.mockResolvedValue({
        id: 'existing',
        username: 'Taken'
      });

      try {
        await useCase.execute({ id: 'p-1', username: 'Taken' });
      } catch {
        // expected
      }

      expect(mockPlayerRepository.create).not.toHaveBeenCalled();
    });
  });
});
