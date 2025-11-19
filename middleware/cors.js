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
      if (!origin) {
        console.log('[CORS] Allowing request without origin header');
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        console.log('[CORS] Allowing request from origin:', origin);
        callback(null, true);
      } else {
        console.warn('[CORS] ⚠️  BLOCKED request from unauthorized origin:', origin);
        console.warn('[CORS] Allowed origins:', ALLOWED_ORIGINS.join(', '));
        console.warn('[CORS] 💡 Add this origin to ALLOWED_ORIGINS environment variable');
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  };
}

module.exports = {
  getSocketIOCorsConfig
};
