/**
 * Unit tests for lib/application/Container.js
 * Infrastructure dependencies are mocked; domain logic is tested directly.
 */

// Mock all infrastructure / database modules before requiring Container
jest.mock('../../../infrastructure/database/DatabaseManager', () => ({
  getInstance: jest.fn().mockReturnValue({
    getDb: jest.fn().mockReturnValue({})
  })
}));

jest.mock('../../../lib/infrastructure/repositories/SQLitePlayerRepository', () =>
  jest.fn().mockImplementation(() => ({ _type: 'playerRepository' }))
);
jest.mock('../../../lib/infrastructure/repositories/SQLiteSessionRepository', () =>
  jest.fn().mockImplementation(() => ({ _type: 'sessionRepository' }))
);
jest.mock('../../../lib/infrastructure/repositories/SQLiteLeaderboardRepository', () =>
  jest.fn().mockImplementation(() => ({ _type: 'leaderboardRepository' }))
);
jest.mock('../../../lib/infrastructure/repositories/SQLiteUpgradesRepository', () =>
  jest.fn().mockImplementation(() => ({ _type: 'upgradesRepository' }))
);
jest.mock('../../../lib/infrastructure/repositories/SQLiteProgressionRepository', () =>
  jest.fn().mockImplementation(() => ({ _type: 'progressionRepository' }))
);
jest.mock('../../../lib/infrastructure/repositories/SQLiteAchievementRepository', () =>
  jest.fn().mockImplementation(() => ({ _type: 'achievementRepository' }))
);
jest.mock('../../../lib/application/AccountProgressionService', () =>
  jest.fn().mockImplementation(() => ({ _type: 'accountProgressionService' }))
);
jest.mock('../../../lib/application/AchievementService', () =>
  jest.fn().mockImplementation(() => ({ _type: 'achievementService' }))
);
jest.mock('../../../lib/application/use-cases/CreatePlayerUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'createPlayerUseCase' }))
);
jest.mock('../../../lib/application/use-cases/UpdatePlayerStatsUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'updatePlayerStatsUseCase' }))
);
jest.mock('../../../lib/application/use-cases/SaveSessionUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'saveSessionUseCase' }))
);
jest.mock('../../../lib/application/use-cases/RecoverSessionUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'recoverSessionUseCase' }))
);
jest.mock('../../../lib/application/use-cases/DisconnectSessionUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'disconnectSessionUseCase' }))
);
jest.mock('../../../contexts/leaderboard/SubmitScoreUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'submitScoreUseCase' }))
);
jest.mock('../../../contexts/leaderboard/GetLeaderboardUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'getLeaderboardUseCase' }))
);
jest.mock('../../../lib/application/use-cases/BuyUpgradeUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'buyUpgradeUseCase' }))
);
jest.mock('../../../lib/application/use-cases/GetUpgradesUseCase', () =>
  jest.fn().mockImplementation(() => ({ _type: 'getUpgradesUseCase' }))
);

// Reset singleton between tests
beforeEach(() => {
  jest.resetModules();
  // Re-apply mocks after resetModules
  jest.mock('../../../infrastructure/database/DatabaseManager', () => ({
    getInstance: jest.fn().mockReturnValue({
      getDb: jest.fn().mockReturnValue({})
    })
  }));
  jest.mock('../../../lib/infrastructure/repositories/SQLitePlayerRepository', () =>
    jest.fn().mockImplementation(() => ({ _type: 'playerRepository' }))
  );
  jest.mock('../../../lib/infrastructure/repositories/SQLiteSessionRepository', () =>
    jest.fn().mockImplementation(() => ({ _type: 'sessionRepository' }))
  );
  jest.mock('../../../lib/infrastructure/repositories/SQLiteLeaderboardRepository', () =>
    jest.fn().mockImplementation(() => ({ _type: 'leaderboardRepository' }))
  );
  jest.mock('../../../lib/infrastructure/repositories/SQLiteUpgradesRepository', () =>
    jest.fn().mockImplementation(() => ({ _type: 'upgradesRepository' }))
  );
  jest.mock('../../../lib/infrastructure/repositories/SQLiteProgressionRepository', () =>
    jest.fn().mockImplementation(() => ({ _type: 'progressionRepository' }))
  );
  jest.mock('../../../lib/infrastructure/repositories/SQLiteAchievementRepository', () =>
    jest.fn().mockImplementation(() => ({ _type: 'achievementRepository' }))
  );
  jest.mock('../../../lib/application/AccountProgressionService', () =>
    jest.fn().mockImplementation(() => ({ _type: 'accountProgressionService' }))
  );
  jest.mock('../../../lib/application/AchievementService', () =>
    jest.fn().mockImplementation(() => ({ _type: 'achievementService' }))
  );
  jest.mock('../../../lib/application/use-cases/CreatePlayerUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'createPlayerUseCase' }))
  );
  jest.mock('../../../lib/application/use-cases/UpdatePlayerStatsUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'updatePlayerStatsUseCase' }))
  );
  jest.mock('../../../lib/application/use-cases/SaveSessionUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'saveSessionUseCase' }))
  );
  jest.mock('../../../lib/application/use-cases/RecoverSessionUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'recoverSessionUseCase' }))
  );
  jest.mock('../../../lib/application/use-cases/DisconnectSessionUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'disconnectSessionUseCase' }))
  );
  jest.mock('../../../contexts/leaderboard/SubmitScoreUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'submitScoreUseCase' }))
  );
  jest.mock('../../../contexts/leaderboard/GetLeaderboardUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'getLeaderboardUseCase' }))
  );
  jest.mock('../../../lib/application/use-cases/BuyUpgradeUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'buyUpgradeUseCase' }))
  );
  jest.mock('../../../lib/application/use-cases/GetUpgradesUseCase', () =>
    jest.fn().mockImplementation(() => ({ _type: 'getUpgradesUseCase' }))
  );
});

// Helper: fresh Container module (bypasses singleton across tests)
const getContainerModule = () => require('../../../lib/application/Container');

describe('Container.getInstance (singleton)', () => {
  test('test_getInstance_calledTwice_returnsSameInstance', () => {
    const { getInstance } = getContainerModule();

    const a = getInstance();
    const b = getInstance();

    expect(a).toBe(b);
  });
});

describe('Container.get', () => {
  test('test_get_afterInitialize_returnsCreatePlayerUseCase', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const useCase = container.get('createPlayerUseCase');

    expect(useCase).toBeDefined();
  });

  test('test_get_afterInitialize_returnsUpdatePlayerStatsUseCase', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const useCase = container.get('updatePlayerStatsUseCase');

    expect(useCase).toBeDefined();
  });

  test('test_get_afterInitialize_returnsSaveSessionUseCase', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const useCase = container.get('saveSessionUseCase');

    expect(useCase).toBeDefined();
  });

  test('test_get_afterInitialize_returnsSubmitScoreUseCase', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const useCase = container.get('submitScoreUseCase');

    expect(useCase).toBeDefined();
  });

  test('test_get_unknownName_throwsError', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    expect(() => container.get('nonExistentUseCase')).toThrow(
      'Use case "nonExistentUseCase" not found in container'
    );
  });

  test('test_get_beforeInitialize_throwsError', () => {
    const { getInstance } = getContainerModule();
    // Fresh instance, never initialized
    const container = getInstance();

    expect(() => container.get('createPlayerUseCase')).toThrow();
  });
});

describe('Container.getRepository', () => {
  test('test_getRepository_player_returnsPlayerRepository', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const repo = container.getRepository('player');

    expect(repo).toBeDefined();
  });

  test('test_getRepository_session_returnsSessionRepository', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const repo = container.getRepository('session');

    expect(repo).toBeDefined();
  });

  test('test_getRepository_unknownName_throwsError', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    expect(() => container.getRepository('unknown')).toThrow(
      'Repository "unknown" not found in container'
    );
  });
});

describe('Container.initialize', () => {
  test('test_initialize_default_storesDatabaseReference', () => {
    const { getInstance } = getContainerModule();
    const container = getInstance();
    container.initialize();

    const db = container.get('database');

    expect(db).toBeDefined();
  });
});
