/**
 * DEPENDENCY INJECTION CONTAINER
 * Wires up all dependencies for clean architecture
 */

const DatabaseManager = require('../../infrastructure/database/DatabaseManager');
const SQLitePlayerRepository = require('../infrastructure/repositories/SQLitePlayerRepository');
const SQLiteSessionRepository = require('../infrastructure/repositories/SQLiteSessionRepository');
const SQLiteLeaderboardRepository = require('../infrastructure/repositories/SQLiteLeaderboardRepository');
const SQLiteUpgradesRepository = require('../infrastructure/repositories/SQLiteUpgradesRepository');
const SQLiteProgressionRepository = require('../infrastructure/repositories/SQLiteProgressionRepository');
const SQLiteAchievementRepository = require('../infrastructure/repositories/SQLiteAchievementRepository');

const AccountProgressionService = require('./AccountProgressionService');
const AchievementService = require('./AchievementService');

const CreatePlayerUseCase = require('./use-cases/CreatePlayerUseCase');
const UpdatePlayerStatsUseCase = require('./use-cases/UpdatePlayerStatsUseCase');
const SaveSessionUseCase = require('./use-cases/SaveSessionUseCase');
const RecoverSessionUseCase = require('./use-cases/RecoverSessionUseCase');
const DisconnectSessionUseCase = require('./use-cases/DisconnectSessionUseCase');
const SubmitScoreUseCase = require('../../contexts/leaderboard/SubmitScoreUseCase');
const GetLeaderboardUseCase = require('../../contexts/leaderboard/GetLeaderboardUseCase');
const BuyUpgradeUseCase = require('./use-cases/BuyUpgradeUseCase');
const GetUpgradesUseCase = require('./use-cases/GetUpgradesUseCase');

/**
 * Conteneur d'injection de dependances pour l'architecture clean.
 * Instancie et connecte tous les repositories, services et use cases.
 * Implemente le pattern Singleton via la factory getInstance().
 * @class
 */
class Container {
  constructor() {
    /**
     * Registre interne des instances gerees par le conteneur.
     * @type {Object.<string, Object>}
     */
    this.instances = {};
  }

  /**
   * Initialise le conteneur en creant toutes les dependances.
   * Ordre : database -> repositories -> services -> use cases.
   * Doit etre appele une seule fois au demarrage de l'application.
   * @returns {void}
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
    this.instances.achievementRepository = new SQLiteAchievementRepository(db);

    // Initialize services
    this.instances.accountProgressionService = new AccountProgressionService(
      this.instances.progressionRepository
    );
    this.instances.achievementService = new AchievementService(
      this.instances.achievementRepository,
      this.instances.playerRepository
    );

    // Initialize use cases
    this.instances.createPlayerUseCase = new CreatePlayerUseCase(this.instances.playerRepository);
    this.instances.updatePlayerStatsUseCase = new UpdatePlayerStatsUseCase(
      this.instances.playerRepository
    );
    this.instances.saveSessionUseCase = new SaveSessionUseCase(this.instances.sessionRepository);
    this.instances.recoverSessionUseCase = new RecoverSessionUseCase(
      this.instances.sessionRepository
    );
    this.instances.disconnectSessionUseCase = new DisconnectSessionUseCase(
      this.instances.sessionRepository
    );
    this.instances.submitScoreUseCase = new SubmitScoreUseCase(
      this.instances.leaderboardRepository,
      this.instances.playerRepository
    );
    this.instances.getLeaderboardUseCase = new GetLeaderboardUseCase(
      this.instances.leaderboardRepository
    );
    this.instances.buyUpgradeUseCase = new BuyUpgradeUseCase(this.instances.upgradesRepository);
    this.instances.getUpgradesUseCase = new GetUpgradesUseCase(this.instances.upgradesRepository);
  }

  /**
   * Recupere une instance enregistree dans le conteneur par son nom.
   * @param {string} name - Nom de l'instance (ex: "createPlayerUseCase", "database")
   * @returns {Object} Instance demandee
   * @throws {Error} Si l'instance n'existe pas dans le conteneur
   */
  get(name) {
    if (!this.instances[name]) {
      throw new Error(`Use case "${name}" not found in container`);
    }
    return this.instances[name];
  }

  /**
   * Recupere un repository par son nom court (sans le suffixe "Repository").
   * @param {string} name - Nom court du repository (ex: "player", "session")
   * @returns {Object} Instance du repository
   * @throws {Error} Si le repository n'existe pas dans le conteneur
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

/**
 * Factory Singleton pour obtenir l'instance unique du conteneur.
 * @returns {Container} Instance unique du conteneur
 */
module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new Container();
    }
    return instance;
  }
};
