/**
 * @fileoverview Socket handler utilities
 * @description Shared utilities for socket event handlers: safe wrapper and arg preview.
 */

const logger = require('../infrastructure/logging/Logger');
const { SOCKET_EVENTS } = require('../transport/websocket/events');

/** Maximum serialized payload size (bytes) accepted from a client socket event. */
const MAX_SOCKET_PAYLOAD_BYTES = 4096;

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
 * Return true if the serialized payload exceeds MAX_SOCKET_PAYLOAD_BYTES.
 * @param {*} data
 * @returns {boolean}
 */
function isPayloadTooLarge(data) {
  if (data === null || data === undefined) {
    return false;
  }
  try {
    const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
    return size > MAX_SOCKET_PAYLOAD_BYTES;
  } catch {
    return true; // unserializable — reject
  }
}

/**
 * Emit a server error event and disconnect the socket.
 * @param {object} socket - Socket.IO socket instance
 * @param {Error} error - The error to report
 * @param {boolean} isDev - Whether to include error details
 */
function emitHandlerError(socket, error, isDev) {
  socket.emit(SOCKET_EVENTS.SERVER.ERROR, {
    message: 'Une erreur est survenue sur le serveur',
    code: 'INTERNAL_ERROR',
    ...(isDev && { details: error.message })
  });
  socket.disconnect(true);
}

/**
 * Attach a rejection handler to a promise returned by a socket handler.
 * @param {Promise} promise
 * @param {string} handlerName
 * @param {object} socket
 * @param {*} firstArg
 * @param {boolean} isDev
 */
function handleAsyncError(promise, handlerName, socket, firstArg, isDev) {
  promise.catch(error => {
    logger.error('Async socket handler error', {
      handler: handlerName,
      socketId: socket.id,
      error: error.message,
      ...(isDev ? { stack: error.stack } : {}),
      argPreview: stringifyArgPreview(firstArg)
    });
    emitHandlerError(socket, error, isDev);
  });
}

/**
 * Wrap a socket handler with error handling, async support, and payload size guard.
 * @param {string} handlerName - Name for logging
 * @param {Function} handler - Handler to wrap
 * @returns {Function} Wrapped handler
 */
function safeHandler(handlerName, handler) {
  return function (...args) {
    const data = args[0];
    if (isPayloadTooLarge(data)) {
      logger.warn('Socket payload rejected: too large', { handler: handlerName, socketId: this.id });
      return;
    }

    const isDev = process.env.NODE_ENV === 'development';
    try {
      const result = handler.apply(this, args);
      if (result instanceof Promise) {
        handleAsyncError(result, handlerName, this, args[0], isDev);
      }
      return result;
    } catch (error) {
      logger.error('Socket handler error', {
        handler: handlerName,
        socketId: this.id,
        error: error.message,
        ...(isDev ? { stack: error.stack } : {}),
        argPreview: args.length > 0 ? stringifyArgPreview(args[0]) : 'no args'
      });
      emitHandlerError(this, error, isDev);
    }
  };
}

module.exports = {
  safeHandler,
  stringifyArgPreview,
  isPayloadTooLarge,
  emitHandlerError,
  handleAsyncError,
  MAX_SOCKET_PAYLOAD_BYTES
};
