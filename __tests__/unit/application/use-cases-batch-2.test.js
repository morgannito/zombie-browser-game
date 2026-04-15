/**
 * Unit tests for AddAccountXPUseCase, CreatePlayerUseCase, BuyUpgradeUseCase.
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

// Mock AccountProgression — constructor + domain methods
const mockAPCtor = jest.fn(function (data) {
  Object.assign(this, data);
  this.addXP = jest.fn(() => ({ levelsGained: 1, newLevel: 2, skillPointsGained: 1 }));
  this.getStats = jest.fn(() => ({ level: 2 }));
  this.getPrestigeBonuses = jest.fn(() => ({ xpBonus: 0 }));
});
jest.mock('../../../lib/domain/entities/AccountProgression', () => mockAPCtor);

// Mock Player — simple ctor
const mockPlayerCtor = jest.fn(function (data) {
  Object.assign(this, data);
});
jest.mock('../../../lib/domain/entities/Player', () => mockPlayerCtor);

const AddAccountXPUseCase = require('../../../lib/application/use-cases/AddAccountXPUseCase');
const CreatePlayerUseCase = require('../../../lib/application/use-cases/CreatePlayerUseCase');
const BuyUpgradeUseCase = require('../../../lib/application/use-cases/BuyUpgradeUseCase');

beforeEach(() => jest.clearAllMocks());

describe('AddAccountXPUseCase.execute', () => {
  function repo() {
    return {
      findByPlayerId: jest.fn(),
      create: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve())
    };
  }

  test('throws when playerId missing', async () => {
    const uc = new AddAccountXPUseCase(repo());
    await expect(uc.execute({ xpEarned: 100 })).rejects.toThrow('Player ID is required');
  });

  test('throws when xpEarned is zero/negative', async () => {
    const uc = new AddAccountXPUseCase(repo());
    await expect(uc.execute({ playerId: 'p1', xpEarned: 0 })).rejects.toThrow('Valid XP amount');
    await expect(uc.execute({ playerId: 'p1', xpEarned: -5 })).rejects.toThrow('Valid XP amount');
  });

  test('creates new progression when none exists', async () => {
    const r = repo();
    r.findByPlayerId.mockResolvedValue(null);
    const uc = new AddAccountXPUseCase(r);
    const result = await uc.execute({ playerId: 'p1', xpEarned: 100 });
    expect(mockAPCtor).toHaveBeenCalledWith({ playerId: 'p1' });
    expect(r.create).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.levelsGained).toBe(1);
  });

  test('uses existing progression', async () => {
    const r = repo();
    const existing = {
      addXP: jest.fn(() => ({ levelsGained: 0, newLevel: 1, skillPointsGained: 0 })),
      getStats: jest.fn(() => ({ level: 1 })),
      getPrestigeBonuses: jest.fn(() => ({}))
    };
    r.findByPlayerId.mockResolvedValue(existing);
    const uc = new AddAccountXPUseCase(r);
    await uc.execute({ playerId: 'p1', xpEarned: 50 });
    expect(existing.addXP).toHaveBeenCalledWith(50);
    expect(r.create).not.toHaveBeenCalled();
    expect(r.update).toHaveBeenCalled();
  });

  test('rethrows and logs repo error', async () => {
    const logger = require('../../../infrastructure/logging/Logger');
    const r = repo();
    r.findByPlayerId.mockRejectedValue(new Error('DB fail'));
    const uc = new AddAccountXPUseCase(r);
    await expect(uc.execute({ playerId: 'p1', xpEarned: 50 })).rejects.toThrow('DB fail');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('AddAccountXPUseCase.calculateXPFromGameStats (static)', () => {
  test('uses base XP of 100 for empty stats', () => {
    expect(AddAccountXPUseCase.calculateXPFromGameStats({})).toBe(100);
  });

  test('aggregates kills, wave, level, survival, boss, combo', () => {
    const xp = AddAccountXPUseCase.calculateXPFromGameStats({
      kills: 50,           // +500
      wave: 5,             // +400 (wave-1 * 100)
      level: 3,            // +100 (level-1 * 50)
      survivalTimeSeconds: 60, // +6
      bossKills: 2,        // +1000
      comboMax: 20         // +100
    });
    expect(xp).toBe(100 + 500 + 400 + 100 + 6 + 1000 + 100);
  });

  test('Math.floors result', () => {
    const xp = AddAccountXPUseCase.calculateXPFromGameStats({ survivalTimeSeconds: 5 });
    expect(xp).toBe(100); // floor(5/10) = 0
  });
});

describe('CreatePlayerUseCase', () => {
  function repo() {
    return {
      findByUsername: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(() => Promise.resolve())
    };
  }

  test('throws ValidationError when id missing', async () => {
    const uc = new CreatePlayerUseCase(repo());
    await expect(uc.execute({ username: 'bob' })).rejects.toThrow('ID and username are required');
  });

  test('throws ValidationError when username too short', async () => {
    const uc = new CreatePlayerUseCase(repo());
    await expect(uc.execute({ id: 'uuid', username: 'x' })).rejects.toThrow('between 2 and 20');
  });

  test('throws ValidationError when username too long', async () => {
    const uc = new CreatePlayerUseCase(repo());
    const long = 'x'.repeat(21);
    await expect(uc.execute({ id: 'uuid', username: long })).rejects.toThrow('between 2 and 20');
  });

  test('throws ConflictError when username already taken', async () => {
    const r = repo();
    r.findByUsername.mockResolvedValue({ id: 'other' });
    const uc = new CreatePlayerUseCase(r);
    await expect(uc.execute({ id: 'uuid', username: 'bob' })).rejects.toThrow('Username already taken');
  });

  test('creates player when valid + unused', async () => {
    const r = repo();
    const uc = new CreatePlayerUseCase(r);
    const player = await uc.execute({ id: 'uuid', username: 'bob' });
    expect(mockPlayerCtor).toHaveBeenCalledWith({ id: 'uuid', username: 'bob' });
    expect(r.create).toHaveBeenCalledWith(player);
  });
});

describe('BuyUpgradeUseCase', () => {
  function upgradesRepo() {
    return {
      getOrCreate: jest.fn(() => Promise.resolve({
        isMaxLevel: jest.fn(() => false),
        upgrade: jest.fn(),
        getLevel: jest.fn(() => 1)
      })),
      update: jest.fn(() => Promise.resolve())
    };
  }

  test('rejects invalid upgrade names', async () => {
    const uc = new BuyUpgradeUseCase(upgradesRepo());
    await expect(uc.execute({ playerId: 'p1', upgradeName: 'unknown' })).rejects.toThrow('Invalid upgrade name');
  });

  test('accepts the 4 valid upgrade names', async () => {
    const uc = new BuyUpgradeUseCase(upgradesRepo());
    for (const name of ['maxHealth', 'damage', 'speed', 'fireRate']) {
      await expect(uc.execute({ playerId: 'p1', upgradeName: name, cost: 10 })).resolves.toBeDefined();
    }
  });

  test('throws BusinessLogicError when already at max level', async () => {
    const r = upgradesRepo();
    r.getOrCreate.mockResolvedValue({
      isMaxLevel: jest.fn(() => true),
      upgrade: jest.fn(),
      getLevel: jest.fn(() => 10)
    });
    const uc = new BuyUpgradeUseCase(r);
    await expect(uc.execute({ playerId: 'p1', upgradeName: 'damage' })).rejects.toThrow('already at max level');
  });

  test('applies upgrade and persists', async () => {
    const upgrades = {
      isMaxLevel: jest.fn(() => false),
      upgrade: jest.fn(),
      getLevel: jest.fn(() => 3)
    };
    const r = upgradesRepo();
    r.getOrCreate.mockResolvedValue(upgrades);
    const uc = new BuyUpgradeUseCase(r);
    await uc.execute({ playerId: 'p1', upgradeName: 'damage', cost: 50 });
    expect(upgrades.upgrade).toHaveBeenCalledWith('damage');
    expect(r.update).toHaveBeenCalledWith(upgrades);
  });

  test('passes custom maxLevel to isMaxLevel check', async () => {
    const upgrades = {
      isMaxLevel: jest.fn(() => false),
      upgrade: jest.fn(),
      getLevel: jest.fn(() => 0)
    };
    const r = upgradesRepo();
    r.getOrCreate.mockResolvedValue(upgrades);
    const uc = new BuyUpgradeUseCase(r);
    await uc.execute({ playerId: 'p1', upgradeName: 'speed', maxLevel: 5 });
    expect(upgrades.isMaxLevel).toHaveBeenCalledWith('speed', 5);
  });
});
