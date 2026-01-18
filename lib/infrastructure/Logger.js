/**
 * LOGGER - Production-ready logging with Winston
 * Replaces console.log with structured, level-based logging
 * @version 1.0.0
 */

let winston = null;
try {
  winston = require('winston');
} catch (error) {
  if (process.env.NODE_ENV !== 'test') {
    throw error;
  }
}
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

let logger = null;
if (winston) {
  // Custom format for console output
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        metaStr = JSON.stringify(meta);
      }
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  );

  // Custom format for file output
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  // Create logger instance
  logger = winston.createLogger({
    level: LOG_LEVEL,
    transports: [
      // Console transport (always enabled)
      new winston.transports.Console({
        format: consoleFormat
      })
    ],
    // Don't exit on error
    exitOnError: false
  });

  // Add file transports only in production
  if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));

    logger.add(new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));
  }
} else {
  const formatArgs = (message, meta) => {
    if (meta && Object.keys(meta).length > 0) {
      return [message, meta];
    }
    return [message];
  };
  const debug = console.debug ? console.debug.bind(console) : console.log.bind(console);
  logger = {
    error: (message, meta) => console.error(...formatArgs(message, meta)),
    warn: (message, meta) => console.warn(...formatArgs(message, meta)),
    info: (message, meta) => console.info(...formatArgs(message, meta)),
    debug: (message, meta) => debug(...formatArgs(message, meta)),
    http: (message) => console.log(message)
  };
}

/**
 * Helper function to check if a log level is enabled
 * Prevents expensive string concatenation when logging is disabled
 */
function isLevelEnabled(level) {
  const levels = { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 };
  const currentLevel = levels[LOG_LEVEL] || levels.info;
  const targetLevel = levels[level] || levels.info;
  return targetLevel <= currentLevel;
}

/**
 * Wrapped logger with level guards
 * Only performs expensive operations if level is enabled
 */
module.exports = {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  debug: (message, meta = {}) => {
    if (isLevelEnabled('debug')) {
      logger.debug(message, meta);
    }
  },

  // Helper to check if debug is enabled (avoid expensive operations)
  isDebugEnabled: () => isLevelEnabled('debug'),
  isInfoEnabled: () => isLevelEnabled('info'),

  // Stream for Morgan HTTP logging
  stream: {
    write: (message) => logger.http(message.trim())
  }
};
