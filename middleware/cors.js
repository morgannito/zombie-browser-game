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
 * @returns {Object} CORS configuration object for Socket.IO
 */
function getSocketIOCorsConfig() {
  return {
    origin: (origin, callback) => {
      // Allow requests without origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('[CORS] Blocked request from origin:', origin);
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  };
}

module.exports = {
  getSocketIOCorsConfig
};
