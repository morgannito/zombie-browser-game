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
const { DailyChallengeService } = require('./DailyChallengeService');
const { SQLiteDailyChallengeRepository } = require('../infrastructure/repositories/SQLiteDailyChallengeRepository');

const CreatePlayerUseCase = require('./use-cases/CreatePlayerUseCase');
const UpdatePlayerStatsUseCase = require('./use-cases/UpdatePlayerStatsUseCase');
const SaveSessionUseCase = require('./use-cases/SaveSessionUseCase');
const RecoverSessionUseCase = require('./use-cases/RecoverSessionUseCase');
const DisconnectSessionUseCase = require('./use-cases/DisconnectSessionUseCase');
const SubmitScoreUseCase = require('../../contexts/leaderboard/SubmitScoreUseCase');
const GetLeaderboardUseCase = require('../../contexts/leaderboard/GetLeaderboardUseCase');
const LeaderboardCache = require('../../contexts/leaderboard/LeaderboardCache');
const BuyUpgradeUseCase = require('./use-cases/BuyUpgradeUseCase');
const GetUpgradesUseCase = require('./use-cases/GetUpgradesUseCase');

/**
 * Registry entry describing how to build a dependency.
 * @typedef {{ factory: function(): *, lifecycle: 'singleton'|'transient', resolved: boolean }} Registration
 */

/**
 * Conteneur d'injection de dependances pour l'architecture clean.
 *
 * Lifecycle :
 *   - singleton  : instancie une seule fois, cache le resultat (defaut)
 *   - transient  : cree une nouvelle instance a chaque resolve()
 *
 * Fonctionnalites :
 *   - Detection de dependances circulaires (resolving set)
 *   - Lazy resolve : rien n'est instancie avant le premier get()
 *   - Override pour les tests via container.override()
 *   - Audit des orphelins via container.auditOrphans()
 * @class
 */
class Container {
  constructor() {
    /** @type {Map<string, Registration>} */
    this._registry = new Map();
    /** @type {Map<string, *>} Cache des singletons resolus */
    this._cache = new Map();
    /** @type {Set<string>} Noms en cours de resolution (detection circulaire) */
    this._resolving = new Set();
    /** @type {Set<string>} Noms effectivement resolus (audit orphelins) */
    this._accessed = new Set();
  }

  /**
   * Enregistre une factory avec son lifecycle.
   * @param {string} name
   * @param {function(): *} factory
   * @param {'singleton'|'transient'} [lifecycle='singleton']
   */
  register(name, factory, lifecycle = 'singleton') {
    this._registry.set(name, { factory, lifecycle });
  }

  /**
   * Surcharge une registration pour les tests (toujours singleton).
   * @param {string} name
   * @param {*} value  Instance ou valeur de remplacement
   */
  override(name, value) {
    this._cache.set(name, value);
    this._registry.set(name, { factory: () => value, lifecycle: 'singleton' });
  }

  /**
   * Resout une dependance par son nom (lazy).
   * @param {string} name
   * @returns {*}
   * @throws {Error} Si name inconnu, ou dependance circulaire detectee
   */
  resolve(name) {
    if (!this._registry.has(name)) {
      throw new Error(`Dependency "${name}" not registered in container`);
    }
    if (this._resolving.has(name)) {
      throw new Error(`Circular dependency detected: "${name}"`);
    }
    const { factory, lifecycle } = this._registry.get(name);
    if (lifecycle === 'singleton' && this._cache.has(name)) {
      this._accessed.add(name);
      return this._cache.get(name);
    }
    this._resolving.add(name);
    let instance;
    try {
      instance = factory();
    } finally {
      this._resolving.delete(name);
    }
    if (lifecycle === 'singleton') {
this._cache.set(name, instance);
}
    this._accessed.add(name);
    return instance;
  }

  /**
   * Alias public de resolve() — compatibilite avec l'API historique.
   * @param {string} name
   * @returns {*}
   */
  get(name) {
    try {
      return this.resolve(name);
    } catch (err) {
      // Rephrase pour garder le meme message d'erreur attendu par les tests
      if (err.message.startsWith('Dependency')) {
        throw new Error(`Use case "${name}" not found in container`);
      }
      throw err;
    }
  }

  /**
   * Recupere un repository par son nom court.
   * @param {string} name  Nom court (ex: "player" -> "playerRepository")
   * @returns {*}
   */
  getRepository(name) {
    const key = `${name}Repository`;
    try {
      return this.resolve(key);
    } catch {
      throw new Error(`Repository "${name}" not found in container`);
    }
  }

  /**
   * Retourne les noms enregistres mais jamais resolus.
   * @returns {string[]}
   */
  auditOrphans() {
    return [...this._registry.keys()].filter((k) => !this._accessed.has(k));
  }

  /**
   * Enregistre toutes les dependances de l'application (lazy).
   * Ordre d'enregistrement sans importance — resolution a la demande.
   * @returns {void}
   */
  initialize() {
    const db = () => DatabaseManager.getInstance().getDb();

    this.register('database', db);

    this.register('playerRepository', () => new SQLitePlayerRepository(this.resolve('database')));
    this.register('sessionRepository', () => new SQLiteSessionRepository(this.resolve('database')));
    this.register(
      'leaderboardRepository',
      () => new SQLiteLeaderboardRepository(this.resolve('database'))
    );
    this.register('upgradesRepository', () => new SQLiteUpgradesRepository(this.resolve('database')));
    this.register(
      'progressionRepository',
      () => new SQLiteProgressionRepository(this.resolve('database'))
    );
    this.register(
      'achievementRepository',
      () => new SQLiteAchievementRepository(this.resolve('database'))
    );

    this.register(
      'accountProgressionService',
      () => new AccountProgressionService(this.resolve('progressionRepository'))
    );
    this.register(
      'achievementService',
      () => new AchievementService(this.resolve('achievementRepository'), this.resolve('playerRepository'))
    );

    this.register('createPlayerUseCase', () => new CreatePlayerUseCase(this.resolve('playerRepository')));
    this.register(
      'updatePlayerStatsUseCase',
      () => new UpdatePlayerStatsUseCase(this.resolve('playerRepository'))
    );
    this.register('saveSessionUseCase', () => new SaveSessionUseCase(this.resolve('sessionRepository')));
    this.register(
      'recoverSessionUseCase',
      () => new RecoverSessionUseCase(this.resolve('sessionRepository'))
    );
    this.register(
      'disconnectSessionUseCase',
      () => new DisconnectSessionUseCase(this.resolve('sessionRepository'))
    );
    this.register('leaderboardCache', () => new LeaderboardCache());
    this.register(
      'submitScoreUseCase',
      () => new SubmitScoreUseCase(
        this.resolve('leaderboardRepository'),
        this.resolve('playerRepository'),
        this.resolve('leaderboardCache')
      )
    );
    this.register(
      'getLeaderboardUseCase',
      () => new GetLeaderboardUseCase(
        this.resolve('leaderboardRepository'),
        this.resolve('leaderboardCache')
      )
    );
    this.register('buyUpgradeUseCase', () => new BuyUpgradeUseCase(this.resolve('upgradesRepository')));
    this.register('getUpgradesUseCase', () => new GetUpgradesUseCase(this.resolve('upgradesRepository')));

    this.register('dailyChallengeRepository', () => new SQLiteDailyChallengeRepository(this.resolve('database')));
    this.register('dailyChallengeService', () => new DailyChallengeService(this.resolve('dailyChallengeRepository')));
  }
}

// Singleton
let instance = null;

/**
 * Factory Singleton pour obtenir l'instance unique du conteneur.
 * @returns {Container}
 */
module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new Container();
    }
    return instance;
  }
};
