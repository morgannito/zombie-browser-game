/**
 * @fileoverview CORS middleware configuration
 * @description Configures Socket.IO CORS with strict origin validation
 * - Validates requests against ALLOWED_ORIGINS
 * - Blocks unauthorized origins
 * - Supports credentials and specific methods
 */

const { ALLOWED_ORIGINS } = require('../config/constants');

/**
 * Socket.IO CORS configuration
 * Uses a callback to validate each origin against ALLOWED_ORIGINS,
 * matching the same security policy as the Express CORS middleware.
 * @returns {Object} CORS configuration object for Socket.IO
 */
function getSocketIOCorsConfig() {
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (server-to-server, health checks)
      if (!origin) {
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  };
}

/**
 * Express CORS middleware — whitelists ALLOWED_ORIGINS.
 * No-origin requests (curl, server-to-server) pass through.
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
}

module.exports = {
  getSocketIOCorsConfig,
  corsMiddleware
};
