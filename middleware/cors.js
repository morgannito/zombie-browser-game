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

module.exports = {
  getSocketIOCorsConfig
};
