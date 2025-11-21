/**
 * DEPENDENCY INJECTION CONTAINER
 * Wires up all dependencies for clean architecture
 */

const DatabaseManager = require('../database/DatabaseManager');
const SQLitePlayerRepository = require('../infrastructure/repositories/SQLitePlayerRepository');
const SQLiteSessionRepository = require('../infrastructure/repositories/SQLiteSessionRepository');
const SQLiteLeaderboardRepository = require('../infrastructure/repositories/SQLiteLeaderboardRepository');
const SQLiteUpgradesRepository = require('../infrastructure/repositories/SQLiteUpgradesRepository');
const SQLiteProgressionRepository = require('../infrastructure/repositories/SQLiteProgressionRepository');

const AccountProgressionService = require('./AccountProgressionService');

const CreatePlayerUseCase = require('./use-cases/CreatePlayerUseCase');
const UpdatePlayerStatsUseCase = require('./use-cases/UpdatePlayerStatsUseCase');
const SaveSessionUseCase = require('./use-cases/SaveSessionUseCase');
const RecoverSessionUseCase = require('./use-cases/RecoverSessionUseCase');
const DisconnectSessionUseCase = require('./use-cases/DisconnectSessionUseCase');
const SubmitScoreUseCase = require('./use-cases/SubmitScoreUseCase');
const GetLeaderboardUseCase = require('./use-cases/GetLeaderboardUseCase');
const BuyUpgradeUseCase = require('./use-cases/BuyUpgradeUseCase');
const GetUpgradesUseCase = require('./use-cases/GetUpgradesUseCase');

class Container {
  constructor() {
    this.instances = {};
  }

  /**
   * Initialize container with database
   */
  initialize() {
    // Get database instance
    const dbManager = DatabaseManager.getInstance();
    const db = dbManager.getDb();

    // Store database reference for routes that need it
    this.instances.database = db;

    // Initialize repositories
    this.instances.playerRepository = new SQLitePlayerRepository(db);
    this.instances.sessionRepository = new SQLiteSessionRepository(db);
    this.instances.leaderboardRepository = new SQLiteLeaderboardRepository(db);
    this.instances.upgradesRepository = new SQLiteUpgradesRepository(db);
    this.instances.progressionRepository = new SQLiteProgressionRepository(db);

    // Initialize services
    this.instances.accountProgressionService = new AccountProgressionService(this.instances.progressionRepository);

    // Initialize use cases
    this.instances.createPlayer = new CreatePlayerUseCase(this.instances.playerRepository);
    this.instances.updatePlayerStats = new UpdatePlayerStatsUseCase(this.instances.playerRepository);
    this.instances.saveSession = new SaveSessionUseCase(this.instances.sessionRepository);
    this.instances.recoverSession = new RecoverSessionUseCase(this.instances.sessionRepository);
    this.instances.disconnectSession = new DisconnectSessionUseCase(this.instances.sessionRepository);
    this.instances.submitScore = new SubmitScoreUseCase(this.instances.leaderboardRepository, this.instances.playerRepository);
    this.instances.getLeaderboard = new GetLeaderboardUseCase(this.instances.leaderboardRepository);
    this.instances.buyUpgrade = new BuyUpgradeUseCase(this.instances.upgradesRepository);
    this.instances.getUpgrades = new GetUpgradesUseCase(this.instances.upgradesRepository);
  }

  /**
   * Get use case instance
   */
  get(name) {
    if (!this.instances[name]) {
      throw new Error(`Use case "${name}" not found in container`);
    }
    return this.instances[name];
  }

  /**
   * Get repository instance
   */
  getRepository(name) {
    const repoName = `${name}Repository`;
    if (!this.instances[repoName]) {
      throw new Error(`Repository "${name}" not found in container`);
    }
    return this.instances[repoName];
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new Container();
    }
    return instance;
  }
};
