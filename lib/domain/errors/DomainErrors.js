/**
 * Custom error classes for the application
 * Provides a structured hierarchy of errors with HTTP status codes
 */

/**
 * Erreur de base de l'application. Toutes les erreurs domaine en heritent.
 * Fournit un code HTTP, un flag operationnel et une stack trace propre.
 * @class
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Message d'erreur descriptif
   * @param {number} [statusCode=500] - Code HTTP associe
   */
  constructor(message, statusCode = 500) {
    super(message);
    /** @type {string} */
    this.name = this.constructor.name;
    /** @type {number} */
    this.statusCode = statusCode;
    /** @type {boolean} */
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreur de validation des donnees d'entree (HTTP 400).
 * Utilisee quand les donnees fournies ne respectent pas les contraintes attendues.
 * @class
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Description de l'erreur de validation
   * @param {string|null} [field=null] - Nom du champ invalide
   */
  constructor(message, field = null) {
    super(message, 400);
    /** @type {string|null} */
    this.field = field;
  }
}

/**
 * Erreur de ressource introuvable (HTTP 404).
 * Utilisee quand une entite demandee n'existe pas en base.
 * @class
 * @extends AppError
 */
class NotFoundError extends AppError {
  /**
   * @param {string} resource - Type de ressource recherchee (ex: "Player", "Session")
   * @param {string|null} [identifier=null] - Identifiant de la ressource recherchee
   */
  constructor(resource, identifier = null) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404);
    /** @type {string} */
    this.resource = resource;
    /** @type {string|null} */
    this.identifier = identifier;
  }
}

/**
 * Erreur de conflit de ressource (HTTP 409).
 * Utilisee pour les duplications (ex: pseudo deja pris).
 * @class
 * @extends AppError
 */
class ConflictError extends AppError {
  /**
   * @param {string} message - Description du conflit
   * @param {string|null} [resource=null] - Type de ressource en conflit
   */
  constructor(message, resource = null) {
    super(message, 409);
    /** @type {string|null} */
    this.resource = resource;
  }
}

/**
 * Erreur de base de donnees (HTTP 500).
 * Encapsule les erreurs techniques de persistence.
 * @class
 * @extends AppError
 */
class DatabaseError extends AppError {
  /**
   * @param {string} [message='Database operation failed'] - Message d'erreur
   * @param {Error|null} [originalError=null] - Erreur originale capturee
   */
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500);
    /** @type {Error|null} */
    this.originalError = originalError;
  }
}

/**
 * Erreur de logique metier (HTTP 422).
 * Utilisee quand une operation viole un invariant du domaine.
 * @class
 * @extends AppError
 */
class BusinessLogicError extends AppError {
  /**
   * @param {string} message - Description de la violation metier
   */
  constructor(message) {
    super(message, 422);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  BusinessLogicError
};
