/**
 * @fileoverview Socket handler utilities
 * @description Shared utilities for socket event handlers: safe wrapper and arg preview.
 */

const logger = require('../lib/infrastructure/Logger');
const { SOCKET_EVENTS } = require('../shared/socketEvents');

/**
 * Truncate a value to a string for logging preview.
 * @param {*} value
 * @param {number} maxLength
 * @returns {string}
 */
function stringifyArgPreview(value, maxLength = 200) {
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
  try {
    const stringified = JSON.stringify(value);
    if (!stringified) {
      return String(value);
    }
    return stringified.length > maxLength ? `${stringified.slice(0, maxLength)}...` : stringified;
  } catch {
    return '[unserializable-arg]';
  }
}

/**
 * Wrap a socket handler with error handling and async support.
 * @param {string} handlerName - Name for logging
 * @param {Function} handler - Handler to wrap
 * @returns {Function} Wrapped handler
 */
function safeHandler(handlerName, handler) {
  return function (...args) {
    try {
      const result = handler.apply(this, args);

      if (result instanceof Promise) {
        result.catch(error => {
          logger.error('Async socket handler error', {
            handler: handlerName,
            socketId: this.id,
            error: error.message,
            stack: error.stack,
            argPreview: stringifyArgPreview(args[0])
          });
          this.emit(SOCKET_EVENTS.SERVER.ERROR, {
            message: 'Une erreur est survenue sur le serveur',
            code: 'INTERNAL_ERROR'
          });
        });
      }

      return result;
    } catch (error) {
      logger.error('Socket handler error', {
        handler: handlerName,
        socketId: this.id,
        error: error.message,
        stack: error.stack,
        argPreview: args.length > 0 ? stringifyArgPreview(args[0]) : 'no args'
      });

      this.emit(SOCKET_EVENTS.SERVER.ERROR, {
        message: 'Une erreur est survenue sur le serveur',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  };
}

module.exports = { safeHandler, stringifyArgPreview };
