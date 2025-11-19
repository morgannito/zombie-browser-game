/**
 * @fileoverview Error handling middlewares
 * @description Provides error handling middleware for:
 * - 404 Not Found errors
 * - 500 Internal Server errors
 * - Other server errors
 */

const logger = require('../lib/infrastructure/Logger');

/**
 * 404 Not Found handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function notFoundHandler(req, res, next) {
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
function serverErrorHandler(err, req, res, next) {
  logger.error('Server error', { status: err.status || 500, stack: err.stack });
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
      <h1>${err.status || 500}</h1>
      <p>💥 Une erreur serveur s'est produite</p>
      <p><a href="/">← Retour au jeu</a></p>
      <div class="error-code">Code d'erreur: ${err.status || 500}</div>
    </body>
    </html>
  `);
}

module.exports = {
  notFoundHandler,
  serverErrorHandler
};
