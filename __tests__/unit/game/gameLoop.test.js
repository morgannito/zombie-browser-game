/**
 * Unit tests for game/gameLoop.js
 * SSS Quality: Critical game loop functions tests
 */

const { handlePlayerDeathProgression } = require('../../../game/gameLoop');

describe('Player Death Progression Handler', () => {
  let mockGameState;
  let mockPlayer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };

    mockGameState = {
      wave: 5,
      progressionIntegration: {
        checkSecondChance: jest.fn(() => false),
        handlePlayerDeath: jest.fn(() => Promise.resolve())
      },
      failedDeathQueue: []
    };

    mockPlayer = {
      id: 'player-123',
      accountId: 'account-456',
      nickname: 'TestPlayer',
      health: 0,
      alive: true,
      level: 10,
      zombiesKilled: 50,
      kills: 50,
      combo: 5,
      highestCombo: 10,
      survivalTime: Date.now() - 60000 // 1 minute
    };
  });

  test('should return false if player is null', () => {
    const result = handlePlayerDeathProgression(null, 'player-123', mockGameState, Date.now(), false, mockLogger);

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid player object'),
      expect.objectContaining({ playerId: 'player-123' })
    );
  });

  test('should return false if player health is invalid', () => {
    mockPlayer.health = 'invalid';

    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, Date.now(), false, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockPlayer.health).toBe(0);
  });

  test('should return false if player health > 0', () => {
    mockPlayer.health = 50;

    const result = handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, Date.now(), false, mockLogger);

    expect(result).toBe(false);
    expect(mockPlayer.alive).toBe(true);
  });

  test('should return true if player is revived by second chance', () => {
    mockGameState.progressionIntegration.checkSecondChance = jest.fn(() => true);

    const result = handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, Date.now(), false, mockLogger);

    expect(result).toBe(true);
    expect(mockGameState.progressionIntegration.checkSecondChance).toHaveBeenCalledWith(mockPlayer);
  });

  test('should mark player as dead if not revived', () => {
    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, Date.now(), false, mockLogger);

    expect(mockPlayer.alive).toBe(false);
    expect(mockPlayer.health).toBe(0);
  });

  test('should call handlePlayerDeath with correct stats', () => {
    const now = Date.now();
    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, now, false, mockLogger);

    expect(mockGameState.progressionIntegration.handlePlayerDeath).toHaveBeenCalledWith(
      mockPlayer,
      mockPlayer.accountId,
      expect.objectContaining({
        wave: 5,
        level: 10,
        kills: 50,
        survivalTimeSeconds: expect.any(Number),
        comboMax: 10,
        bossKills: 0
      })
    );
  });

  test('should add to retry queue on handlePlayerDeath error', async () => {
    const error = new Error('Database error');
    mockGameState.progressionIntegration.handlePlayerDeath = jest.fn(() => Promise.reject(error));

    const now = Date.now();
    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, now, false, mockLogger);

    // Wait for promise to reject
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGameState.failedDeathQueue.length).toBe(1);
    expect(mockGameState.failedDeathQueue[0]).toMatchObject({
      player: {
        id: mockPlayer.id,
        accountId: mockPlayer.accountId,
        nickname: mockPlayer.nickname
      },
      accountId: mockPlayer.accountId,
      stats: expect.any(Object),
      timestamp: now,
      retryCount: 0
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: Failed to handle player death'),
      expect.objectContaining({
        error: error.message
      })
    );
  });

  test('should not exceed failed death queue max size', async () => {
    const FAILED_DEATH_QUEUE_MAX_SIZE = 100;
    mockGameState.failedDeathQueue = new Array(FAILED_DEATH_QUEUE_MAX_SIZE).fill({});
    mockGameState.progressionIntegration.handlePlayerDeath = jest.fn(() => Promise.reject(new Error('Error')));

    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, Date.now(), false, mockLogger);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGameState.failedDeathQueue.length).toBe(FAILED_DEATH_QUEUE_MAX_SIZE);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed death queue full'),
      expect.any(Object)
    );
  });

  test('should handle boss kills correctly', () => {
    const now = Date.now();
    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, now, true, mockLogger);

    expect(mockGameState.progressionIntegration.handlePlayerDeath).toHaveBeenCalledWith(
      mockPlayer,
      mockPlayer.accountId,
      expect.objectContaining({
        bossKills: 1
      })
    );
  });

  test('should handle missing highestCombo gracefully', () => {
    delete mockPlayer.highestCombo;
    mockPlayer.combo = 15;

    const now = Date.now();
    handlePlayerDeathProgression(mockPlayer, 'player-123', mockGameState, now, false, mockLogger);

    expect(mockGameState.progressionIntegration.handlePlayerDeath).toHaveBeenCalledWith(
      mockPlayer,
      mockPlayer.accountId,
      expect.objectContaining({
        comboMax: 15
      })
    );
  });
});
