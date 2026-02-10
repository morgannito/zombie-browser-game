/**
 * BUY UPGRADE USE CASE - Unit Tests
 * Tests permanent upgrade purchasing with mocked repository
 */

const BuyUpgradeUseCase = require('../../../lib/application/use-cases/BuyUpgradeUseCase');
const PermanentUpgrades = require('../../../lib/domain/entities/PermanentUpgrades');

// Mock Logger
jest.mock('../../../lib/infrastructure/Logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('BuyUpgradeUseCase', () => {
  let useCase;
  let mockUpgradesRepository;

  beforeEach(() => {
    mockUpgradesRepository = {
      getOrCreate: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      findByPlayerId: jest.fn()
    };

    useCase = new BuyUpgradeUseCase(mockUpgradesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - successful purchase', () => {
    it('should buy maxHealth upgrade successfully', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        maxHealthLevel: 0
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      const result = await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'maxHealth',
        cost: 100
      });

      expect(result.maxHealthLevel).toBe(1);
      expect(mockUpgradesRepository.update).toHaveBeenCalledTimes(1);
    });

    it('should buy damage upgrade successfully', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        damageLevel: 3
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      const result = await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'damage',
        cost: 200
      });

      expect(result.damageLevel).toBe(4);
    });

    it('should buy speed upgrade successfully', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        speedLevel: 5
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      const result = await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'speed',
        cost: 300
      });

      expect(result.speedLevel).toBe(6);
    });

    it('should buy fireRate upgrade successfully', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        fireRateLevel: 7
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      const result = await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'fireRate',
        cost: 400
      });

      expect(result.fireRateLevel).toBe(8);
    });

    it('should call getOrCreate on repository', async () => {
      const upgrades = new PermanentUpgrades({ playerId: 'player-001' });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'damage',
        cost: 100
      });

      expect(mockUpgradesRepository.getOrCreate).toHaveBeenCalledWith('player-001');
    });

    it('should persist the upgraded entity', async () => {
      const upgrades = new PermanentUpgrades({ playerId: 'player-001' });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'maxHealth',
        cost: 100
      });

      expect(mockUpgradesRepository.update).toHaveBeenCalledWith(upgrades);
      expect(upgrades.maxHealthLevel).toBe(1);
    });
  });

  describe('execute - validation: invalid upgrade name', () => {
    it('should throw for unknown upgrade name', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-001',
          upgradeName: 'superPower',
          cost: 100
        })
      ).rejects.toThrow('Invalid upgrade name: superPower');
    });

    it('should throw for empty upgrade name', async () => {
      await expect(
        useCase.execute({
          playerId: 'player-001',
          upgradeName: '',
          cost: 100
        })
      ).rejects.toThrow('Invalid upgrade name: ');
    });

    it('should not call repository for invalid upgrade name', async () => {
      try {
        await useCase.execute({
          playerId: 'player-001',
          upgradeName: 'invalid',
          cost: 100
        });
      } catch {
        // expected
      }

      expect(mockUpgradesRepository.getOrCreate).not.toHaveBeenCalled();
    });
  });

  describe('execute - validation: max level reached', () => {
    it('should throw when upgrade is already at max level (default 10)', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        damageLevel: 10
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      await expect(
        useCase.execute({
          playerId: 'player-001',
          upgradeName: 'damage',
          cost: 500
        })
      ).rejects.toThrow('Upgrade damage already at max level');
    });

    it('should throw when upgrade exceeds custom max level', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        speedLevel: 5
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      await expect(
        useCase.execute({
          playerId: 'player-001',
          upgradeName: 'speed',
          cost: 200,
          maxLevel: 5
        })
      ).rejects.toThrow('Upgrade speed already at max level');
    });

    it('should not call update when at max level', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        maxHealthLevel: 10
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      try {
        await useCase.execute({
          playerId: 'player-001',
          upgradeName: 'maxHealth',
          cost: 999
        });
      } catch {
        // expected
      }

      expect(mockUpgradesRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('execute - edge cases', () => {
    it('should allow buying up to level 9 when max is 10', async () => {
      const upgrades = new PermanentUpgrades({
        playerId: 'player-001',
        fireRateLevel: 9
      });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      const result = await useCase.execute({
        playerId: 'player-001',
        upgradeName: 'fireRate',
        cost: 900
      });

      expect(result.fireRateLevel).toBe(10);
    });

    it('should handle a fresh player with all levels at 0', async () => {
      const upgrades = new PermanentUpgrades({ playerId: 'player-new' });
      mockUpgradesRepository.getOrCreate.mockResolvedValue(upgrades);

      const result = await useCase.execute({
        playerId: 'player-new',
        upgradeName: 'damage',
        cost: 50
      });

      expect(result.damageLevel).toBe(1);
      expect(result.getTotalUpgrades()).toBe(1);
    });
  });
});
