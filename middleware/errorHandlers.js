/**
 * @fileoverview Error handling middlewares
 * @description Provides error handling middleware for:
 * - 404 Not Found errors
 * - 500 Internal Server errors
 * - API error responses
 * - Other server errors
 */

const logger = require("../infrastructure/logging/Logger");
const { AppError } = require('../lib/domain/errors/DomainErrors');
const { buildHttpContext } = require('./httpContext');

/**
 * Escape HTML special chars to prevent reflected XSS in error pages.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function notFoundHandler(req, res, _next) {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Page non trouvée</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        h1 { font-size: 72px; margin: 0; }
        p { font-size: 24px; }
        a { color: #ffeb3b; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>404</h1>
      <p>🧟 Page non trouvée</p>
      <p><a href="/">← Retour au jeu</a></p>
    </body>
    </html>
  `);
}

/**
 * Server error handler
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function serverErrorHandler(err, req, res, _next) {
  logger.error(
    'Server error',
    buildHttpContext(req, {
      status: err.status || 500,
      error: err.message,
      stack: err.stack
    })
  );
  res.status(err.status || 500).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Erreur serveur</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        h1 { font-size: 72px; margin: 0; }
        p { font-size: 24px; }
        a { color: #ffeb3b; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
        .error-code { opacity: 0.7; font-size: 18px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(err.status || 500)}</h1>
      <p>💥 Une erreur serveur s'est produite</p>
      <p><a href="/">← Retour au jeu</a></p>
      <div class="error-code">Code d'erreur: ${escapeHtml(err.status || 500)}</div>
    </body>
    </html>
  `);
}

/**
 * API error handler - Provides standardized JSON error responses
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function apiErrorHandler(err, req, res, next) {
  // Handle only explicit API-style routes to avoid hijacking static asset errors.
  const isApiRoute = req.path.startsWith('/api/') || req.path === '/health';

  if (!isApiRoute) {
    return next(err); // Pass to HTML error handler
  }

  // Default to 500 for unexpected errors
  let statusCode = 500;
  let message = 'Internal server error';
  const errorDetails = {};

  // Handle our custom errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;

    // Include additional error details if available
    if (err.field) {
      errorDetails.field = err.field;
    }
    if (err.resource) {
      errorDetails.resource = err.resource;
    }
    if (err.identifier) {
      errorDetails.identifier = err.identifier;
    }
  } else {
    if (typeof err.status === 'number' || typeof err.statusCode === 'number') {
      statusCode = err.status || err.statusCode;
      message = err.message || (statusCode === 404 ? 'Not found' : 'Request failed');
    }

    // For non-operational errors, log the full error
    logger.error(
      'Unexpected API error',
      buildHttpContext(req, {
        statusCode,
        error: err.message,
        stack: err.stack
      })
    );
  }

  // Build error response
  const errorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      requestId: req.id || null,
      ...errorDetails
    }
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper - Wraps async route handlers to catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  escapeHtml,
  notFoundHandler,
  serverErrorHandler,
  apiErrorHandler,
  asyncHandler
};
