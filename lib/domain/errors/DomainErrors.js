/**
 * Custom error classes for the application
 * Provides a structured hierarchy of errors with HTTP status codes
 */

/**
 * Base application error
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation errors (400)
 */
class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.field = field;
  }
}

/**
 * Resource not found errors (404)
 */
class NotFoundError extends AppError {
  constructor(resource, identifier = null) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404);
    this.resource = resource;
    this.identifier = identifier;
  }
}

/**
 * Authentication errors (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

/**
 * Authorization errors (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

/**
 * Conflict errors (409) - e.g., duplicate resources
 */
class ConflictError extends AppError {
  constructor(message, resource = null) {
    super(message, 409);
    this.resource = resource;
  }
}

/**
 * Database errors (500)
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500);
    this.originalError = originalError;
  }
}

/**
 * External service errors (502)
 */
class ExternalServiceError extends AppError {
  constructor(service, message = 'External service unavailable') {
    super(`${service}: ${message}`, 502);
    this.service = service;
  }
}

/**
 * Rate limit errors (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Business logic errors (422)
 */
class BusinessLogicError extends AppError {
  constructor(message) {
    super(message, 422);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  BusinessLogicError
};
