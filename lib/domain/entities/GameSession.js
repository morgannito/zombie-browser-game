/**
 * GAME SESSION ENTITY - Domain model
 * Represents an active or recoverable game session
 */

/**
 * Represente une session de jeu active ou recuperable apres deconnexion.
 * Gere le cycle de vie d'une connexion joueur : creation, deconnexion, reconnexion.
 * @class
 */
class GameSession {
  /**
   * @param {Object} data - Donnees d'initialisation de la session
   * @param {string} data.sessionId - Identifiant unique de la session
   * @param {string} data.playerId - UUID du joueur associe
   * @param {string|null} [data.socketId=null] - ID du socket WebSocket actif
   * @param {Object|null} [data.state=null] - Etat serialise de la partie en cours
   * @param {number} [data.createdAt=Date.now()] - Timestamp de creation
   * @param {number} [data.updatedAt=Date.now()] - Timestamp de derniere mise a jour
   * @param {number|null} [data.disconnectedAt=null] - Timestamp de deconnexion (null si connecte)
   */
  constructor({
    sessionId,
    playerId,
    socketId = null,
    state = null,
    createdAt = Date.now(),
    updatedAt = Date.now(),
    disconnectedAt = null
  }) {
    /** @type {string} */
    this.sessionId = sessionId;
    /** @type {string} */
    this.playerId = playerId;
    /** @type {string|null} */
    this.socketId = socketId;
    /** @type {Object|null} */
    this.state = state;
    /** @type {number} */
    this.createdAt = createdAt;
    /** @type {number} */
    this.updatedAt = updatedAt;
    /** @type {number|null} */
    this.disconnectedAt = disconnectedAt;
  }

  /**
   * Marque la session comme deconnectee avec le timestamp courant.
   * @returns {void}
   */
  disconnect() {
    this.disconnectedAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Reconnecte la session avec un nouveau socket WebSocket.
   * Reinitialise le timestamp de deconnexion a null.
   * @param {string} socketId - Nouvel identifiant de socket
   * @returns {void}
   */
  reconnect(socketId) {
    this.socketId = socketId;
    this.disconnectedAt = null;
    this.updatedAt = Date.now();
  }

  /**
   * Met a jour l'etat serialise de la partie en cours.
   * @param {Object} state - Nouvel etat de la partie
   * @returns {void}
   */
  updateState(state) {
    this.state = state;
    this.updatedAt = Date.now();
  }

  /**
   * Verifie si la session est actuellement active (connectee avec un socket valide).
   * @returns {boolean} true si la session est active
   */
  isActive() {
    return this.disconnectedAt === null && this.socketId !== null;
  }

  /**
   * Verifie si la session peut etre recuperee apres deconnexion.
   * Une session est recuperable si elle a ete deconnectee il y a moins de timeoutMs.
   * @param {number} [timeoutMs=300000] - Delai maximum de recuperation en millisecondes (defaut 5 min)
   * @returns {boolean} true si la session est recuperable
   */
  isRecoverable(timeoutMs = 300000) {
    if (!this.disconnectedAt) {
      return false;
    }
    return Date.now() - this.disconnectedAt < timeoutMs;
  }

  /**
   * Retourne la duree ecoulee depuis la deconnexion en secondes.
   * @returns {number} Duree en secondes (0 si la session n'est pas deconnectee)
   */
  getDisconnectedDuration() {
    if (!this.disconnectedAt) {
      return 0;
    }
    return Math.floor((Date.now() - this.disconnectedAt) / 1000);
  }

  /**
   * Convertit l'entite en objet simple pour la serialisation.
   * @returns {Object} Representation plain object de la session
   */
  toObject() {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      socketId: this.socketId,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      disconnectedAt: this.disconnectedAt
    };
  }

  /**
   * Cree une instance GameSession a partir d'une ligne de base de donnees.
   * Convertit les noms snake_case en camelCase, parse le JSON state,
   * et convertit les timestamps secondes en millisecondes.
   * @param {Object} row - Ligne brute de la base de donnees
   * @param {string} row.session_id - ID de session
   * @param {string} row.player_id - UUID du joueur
   * @param {string|null} row.socket_id - ID du socket
   * @param {string|null} row.state - Etat JSON serialise
   * @param {number} row.created_at - Timestamp creation (secondes UNIX)
   * @param {number} row.updated_at - Timestamp mise a jour (secondes UNIX)
   * @param {number|null} row.disconnected_at - Timestamp deconnexion (secondes UNIX ou null)
   * @returns {GameSession} Nouvelle instance GameSession hydratee
   */
  static fromDB(row) {
    return new GameSession({
      sessionId: row.session_id,
      playerId: row.player_id,
      socketId: row.socket_id,
      state: row.state ? JSON.parse(row.state) : null,
      createdAt: row.created_at * 1000,
      updatedAt: row.updated_at * 1000,
      disconnectedAt: row.disconnected_at ? row.disconnected_at * 1000 : null
    });
  }
}

module.exports = GameSession;
