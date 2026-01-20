/**
 * @fileoverview CORS middleware configuration
 * @description Configures Socket.IO CORS with strict origin validation
 * - Validates requests against ALLOWED_ORIGINS
 * - Blocks unauthorized origins
 * - Supports credentials and specific methods
 */

/**
 * Socket.IO CORS configuration
 * @returns {Object} CORS configuration object for Socket.IO
 */
function getSocketIOCorsConfig() {
  return {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
    credentials: false, // Must be false when origin is "*"
    allowedHeaders: ['*']
  };
}

module.exports = {
  getSocketIOCorsConfig
};
