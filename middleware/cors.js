/**
 * @fileoverview CORS middleware configuration
 * @description Configures Socket.IO CORS with strict origin validation
 * - Validates requests against ALLOWED_ORIGINS
 * - Blocks unauthorized origins
 * - Supports credentials and specific methods
 */

const { ALLOWED_ORIGINS } = require('../config/constants');
const logger = require('../lib/infrastructure/Logger');

/**
 * Socket.IO CORS configuration with strict origin validation
 * @returns {Object} CORS configuration object for Socket.IO
 */
function getSocketIOCorsConfig() {
  // Development mode: allow all origins for testing
  if (process.env.NODE_ENV === 'development') {
    logger.warn('CORS: Development mode - allowing all origins');
    return {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false,
      allowedHeaders: ["*"]
    };
  }

  // Production mode: strict origin validation
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        logger.debug('CORS: Origin allowed', { origin });
        callback(null, true);
      } else {
        logger.warn('CORS: Origin blocked', { origin, allowed: ALLOWED_ORIGINS });
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  };
}

module.exports = {
  getSocketIOCorsConfig
};
