/**
 * Unit tests for batch of use-cases (session + player + upgrades).
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const mockSessionCtor = jest.fn(function (data) {
  Object.assign(this, data);
  this.updateState = jest.fn(state => {
 this.state = state;
});
});
jest.mock('../../../lib/domain/entities/GameSession', () => mockSessionCtor);

const GetUpgradesUseCase = require('../../../lib/application/use-cases/GetUpgradesUseCase');
const SaveSessionUseCase = require('../../../lib/application/use-cases/SaveSessionUseCase');
const RecoverSessionUseCase = require('../../../lib/application/use-cases/RecoverSessionUseCase');
const DisconnectSessionUseCase = require('../../../lib/application/use-cases/DisconnectSessionUseCase');
const UpdatePlayerStatsUseCase = require('../../../lib/application/use-cases/UpdatePlayerStatsUseCase');

function upgradesRepo() {
  return {
    getOrCreate: jest.fn(() => Promise.resolve({
      toObject: () => ({ damage: 2 }),
      getAllLevels: () => ({ damage: 2 }),
      getTotalUpgrades: () => 2
    }))
  };
}

function sessionRepo() {
  return {
    findById: jest.fn(),
    update: jest.fn(() => Promise.resolve()),
    create: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    cleanupExpired: jest.fn(() => Promise.resolve(0))
  };
}

function playerRepo() {
  return {
    findById: jest.fn(),
    update: jest.fn(() => Promise.resolve())
  };
}

beforeEach(() => jest.clearAllMocks());

describe('GetUpgradesUseCase', () => {
  test('throws when playerId missing', async () => {
    const uc = new GetUpgradesUseCase(upgradesRepo());
    await expect(uc.execute({})).rejects.toThrow('Player ID required');
  });

  test('returns upgrades + levels + totalPoints', async () => {
    const repo = upgradesRepo();
    const uc = new GetUpgradesUseCase(repo);
    const result = await uc.execute({ playerId: 'p1' });
    expect(repo.getOrCreate).toHaveBeenCalledWith('p1');
    expect(result).toEqual({
      upgrades: { damage: 2 },
      levels: { damage: 2 },
      totalPoints: 2
    });
  });
});

describe('SaveSessionUseCase', () => {
  test('creates new session when none exists', async () => {
    const repo = sessionRepo();
    repo.findById.mockResolvedValue(null);
    const uc = new SaveSessionUseCase(repo);
    const result = await uc.execute({ sessionId: 's1', playerId: 'p1', socketId: 'sock', state: { x: 1 } });
    expect(mockSessionCtor).toHaveBeenCalledWith({ sessionId: 's1', playerId: 'p1', socketId: 'sock', state: { x: 1 } });
    expect(repo.create).toHaveBeenCalled();
    expect(result.sessionId).toBe('s1');
  });

  test('updates existing session with new socketId and state', async () => {
    const repo = sessionRepo();
    const existing = { sessionId: 's1', updateState: jest.fn() };
    repo.findById.mockResolvedValue(existing);
    const uc = new SaveSessionUseCase(repo);
    await uc.execute({ sessionId: 's1', playerId: 'p1', socketId: 'new-sock', state: { y: 2 } });
    expect(existing.socketId).toBe('new-sock');
    expect(existing.updateState).toHaveBeenCalledWith({ y: 2 });
    expect(repo.update).toHaveBeenCalledWith(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('skips socketId/state update when omitted', async () => {
    const repo = sessionRepo();
    const existing = { sessionId: 's1', socketId: 'old', updateState: jest.fn() };
    repo.findById.mockResolvedValue(existing);
    const uc = new SaveSessionUseCase(repo);
    await uc.execute({ sessionId: 's1', playerId: 'p1' });
    expect(existing.socketId).toBe('old');
    expect(existing.updateState).not.toHaveBeenCalled();
  });
});

describe('RecoverSessionUseCase', () => {
  test('returns null when session not found', async () => {
    const repo = sessionRepo();
    repo.findById.mockResolvedValue(null);
    const uc = new RecoverSessionUseCase(repo);
    expect(await uc.execute({ sessionId: 's1', newSocketId: 'n' })).toBeNull();
  });

  test('cleans up and returns null when session expired', async () => {
    const repo = sessionRepo();
    const session = {
      sessionId: 's1',
      isRecoverable: jest.fn(() => false),
      getDisconnectedDuration: jest.fn(() => 999)
    };
    repo.findById.mockResolvedValue(session);
    const uc = new RecoverSessionUseCase(repo);
    const result = await uc.execute({ sessionId: 's1', newSocketId: 'n' });
    expect(repo.delete).toHaveBeenCalledWith('s1');
    expect(result).toBeNull();
  });

  test('reconnects session and returns it when recoverable', async () => {
    const repo = sessionRepo();
    const session = {
      sessionId: 's1',
      playerId: 'p1',
      isRecoverable: jest.fn(() => true),
      getDisconnectedDuration: jest.fn(() => 10),
      reconnect: jest.fn()
    };
    repo.findById.mockResolvedValue(session);
    const uc = new RecoverSessionUseCase(repo);
    const result = await uc.execute({ sessionId: 's1', newSocketId: 'new-sock' });
    expect(session.reconnect).toHaveBeenCalledWith('new-sock');
    expect(repo.update).toHaveBeenCalledWith(session);
    expect(result).toBe(session);
  });

  test('uses default 5min timeout when not provided', async () => {
    const repo = sessionRepo();
    const session = {
      isRecoverable: jest.fn(() => true),
      reconnect: jest.fn(),
      getDisconnectedDuration: () => 0,
      playerId: 'p1'
    };
    repo.findById.mockResolvedValue(session);
    const uc = new RecoverSessionUseCase(repo);
    await uc.execute({ sessionId: 's1', newSocketId: 'n' });
    expect(session.isRecoverable).toHaveBeenCalledWith(300000);
  });
});

describe('DisconnectSessionUseCase', () => {
  test('returns null when session not found', async () => {
    const repo = sessionRepo();
    repo.findById.mockResolvedValue(null);
    const uc = new DisconnectSessionUseCase(repo);
    expect(await uc.execute({ sessionId: 's1' })).toBeNull();
  });

  test('deletes session immediately when saveState=false', async () => {
    const repo = sessionRepo();
    repo.findById.mockResolvedValue({ sessionId: 's1', playerId: 'p1' });
    const uc = new DisconnectSessionUseCase(repo);
    const result = await uc.execute({ sessionId: 's1', saveState: false });
    expect(repo.delete).toHaveBeenCalledWith('s1');
    expect(result).toBeNull();
  });

  test('marks session disconnected when saveState=true (default)', async () => {
    const repo = sessionRepo();
    const session = {
      sessionId: 's1',
      playerId: 'p1',
      disconnect: jest.fn()
    };
    repo.findById.mockResolvedValue(session);
    const uc = new DisconnectSessionUseCase(repo);
    const result = await uc.execute({ sessionId: 's1' });
    expect(session.disconnect).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(session);
    expect(result).toBe(session);
  });

  test('cleanupExpired delegates to repo', async () => {
    const repo = sessionRepo();
    repo.cleanupExpired.mockResolvedValue(3);
    const uc = new DisconnectSessionUseCase(repo);
    const count = await uc.cleanupExpired(1000);
    expect(repo.cleanupExpired).toHaveBeenCalledWith(1000);
    expect(count).toBe(3);
  });

  test('cleanupExpired uses default 10min maxAge', async () => {
    const repo = sessionRepo();
    const uc = new DisconnectSessionUseCase(repo);
    await uc.cleanupExpired();
    expect(repo.cleanupExpired).toHaveBeenCalledWith(600000);
  });
});

describe('UpdatePlayerStatsUseCase', () => {
  test('throws when player not found', async () => {
    const repo = playerRepo();
    repo.findById.mockResolvedValue(null);
    const uc = new UpdatePlayerStatsUseCase(repo);
    await expect(uc.execute({ playerId: 'p1' })).rejects.toThrow("Player with identifier 'p1' not found");
  });

  test('updates stats with defaults for missing fields', async () => {
    const repo = playerRepo();
    const player = {
      isNewRecord: jest.fn(() => false),
      updateStats: jest.fn()
    };
    repo.findById.mockResolvedValue(player);
    const uc = new UpdatePlayerStatsUseCase(repo);
    await uc.execute({ playerId: 'p1', wave: 5, level: 3 });
    expect(player.updateStats).toHaveBeenCalledWith({
      kills: 0, deaths: 0, wave: 5, level: 3, playtime: 0, goldEarned: 0
    });
    expect(repo.update).toHaveBeenCalledWith(player);
  });

  test('logs newRecord when isNewRecord returns true', async () => {
    const logger = require('../../../infrastructure/logging/Logger');
    const repo = playerRepo();
    const player = {
      isNewRecord: jest.fn(() => true),
      updateStats: jest.fn()
    };
    repo.findById.mockResolvedValue(player);
    const uc = new UpdatePlayerStatsUseCase(repo);
    await uc.execute({ playerId: 'p1', wave: 20, level: 10 });
    expect(logger.info).toHaveBeenCalledWith(
      'Player stats updated',
      expect.objectContaining({ newRecord: true })
    );
  });
});
