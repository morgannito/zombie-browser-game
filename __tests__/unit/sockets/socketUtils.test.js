/**
 * Unit tests for sockets/socketUtils.js
 * Covers: safeHandler, stringifyArgPreview
 */

/* global setImmediate */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

const { safeHandler, stringifyArgPreview } = require('../../../sockets/socketUtils');
const logger = require('../../../infrastructure/logging/Logger');

// ---------------------------------------------------------------------------
// stringifyArgPreview
// ---------------------------------------------------------------------------

describe('stringifyArgPreview', () => {
  test('test_undefined_value_returns_string_undefined', () => {
    // Arrange / Act
    const result = stringifyArgPreview(undefined);

    // Assert
    expect(result).toBe('undefined');
  });

  test('test_short_string_returned_as_is', () => {
    // Arrange / Act
    const result = stringifyArgPreview('hello');

    // Assert
    expect(result).toBe('hello');
  });

  test('test_long_string_truncated_with_ellipsis', () => {
    // Arrange
    const longString = 'a'.repeat(300);

    // Act
    const result = stringifyArgPreview(longString);

    // Assert
    expect(result).toHaveLength(203); // 200 chars + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  test('test_object_serialized_as_json', () => {
    // Arrange / Act
    const result = stringifyArgPreview({ key: 'value' });

    // Assert
    expect(result).toBe('{"key":"value"}');
  });

  test('test_large_object_truncated_with_ellipsis', () => {
    // Arrange
    const big = { data: 'x'.repeat(300) };

    // Act
    const result = stringifyArgPreview(big);

    // Assert
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBe(203);
  });

  test('test_custom_max_length_respected', () => {
    // Arrange
    const str = 'abcdefghij'; // 10 chars

    // Act
    const result = stringifyArgPreview(str, 5);

    // Assert
    expect(result).toBe('abcde...');
  });

  test('test_unserializable_object_returns_fallback', () => {
    // Arrange
    const circular = {};
    circular.self = circular;

    // Act
    const result = stringifyArgPreview(circular);

    // Assert
    expect(result).toBe('[unserializable-arg]');
  });

  test('test_number_value_serialized_as_json', () => {
    // Arrange / Act
    const result = stringifyArgPreview(42);

    // Assert
    expect(result).toBe('42');
  });

  test('test_null_value_serialized_as_null', () => {
    // Arrange / Act
    const result = stringifyArgPreview(null);

    // Assert
    expect(result).toBe('null');
  });
});

// ---------------------------------------------------------------------------
// safeHandler
// ---------------------------------------------------------------------------

describe('safeHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  function makeSocket(id = 'sock-1') {
    return { id, emit: jest.fn(), disconnect: jest.fn() };
  }

  test('test_sync_handler_called_with_args', () => {
    // Arrange
    const handler = jest.fn(() => 'result');
    const socket = makeSocket();
    const wrapped = safeHandler('testEvent', handler).bind(socket);

    // Act
    wrapped('arg1', 'arg2');

    // Assert
    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
  });

  test('test_sync_handler_return_value_propagated', () => {
    // Arrange
    const handler = jest.fn(() => 42);
    const socket = makeSocket();
    const wrapped = safeHandler('testEvent', handler).bind(socket);

    // Act
    const result = wrapped();

    // Assert
    expect(result).toBe(42);
  });

  test('test_sync_handler_throws_emits_error_to_socket', () => {
    // Arrange
    const handler = jest.fn(() => {
      throw new Error('boom');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('testEvent', handler).bind(socket);

    // Act
    wrapped('payload');

    // Assert
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        code: 'INTERNAL_ERROR'
      })
    );
  });

  test('test_sync_handler_throws_logs_error', () => {
    // Arrange
    const handler = jest.fn(() => {
      throw new Error('bad');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('myHandler', handler).bind(socket);

    // Act
    wrapped();

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      'Socket handler error',
      expect.objectContaining({ handler: 'myHandler', error: 'bad' })
    );
  });

  test('test_sync_error_includes_details_in_development', () => {
    // Arrange
    process.env.NODE_ENV = 'development';
    const handler = jest.fn(() => {
      throw new Error('dev error');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('devEvent', handler).bind(socket);

    // Act
    wrapped();

    // Assert
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        details: 'dev error'
      })
    );
  });

  test('test_sync_error_no_details_in_production', () => {
    // Arrange
    process.env.NODE_ENV = 'production';
    const handler = jest.fn(() => {
      throw new Error('secret');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('prodEvent', handler).bind(socket);

    // Act
    wrapped();

    // Assert
    const emitted = socket.emit.mock.calls[0][1];
    expect(emitted.details).toBeUndefined();
  });

  test('test_async_handler_resolves_successfully_no_error_emit', async () => {
    // Arrange
    const handler = jest.fn(async () => 'ok');
    const socket = makeSocket();
    const wrapped = safeHandler('asyncOk', handler).bind(socket);

    // Act
    const promise = wrapped();
    await promise;
    // Allow microtasks to settle
    await Promise.resolve();

    // Assert
    expect(socket.emit).not.toHaveBeenCalled();
  });

  test('test_async_handler_rejects_emits_error_to_socket', async () => {
    // Arrange
    const handler = jest.fn(async () => {
      throw new Error('async fail');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('asyncFail', handler).bind(socket);

    // Act
    const returnedPromise = wrapped();
    await returnedPromise.catch(() => {});
    // Allow rejection handler to fire
    await new Promise(resolve => setImmediate(resolve));

    // Assert
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        code: 'INTERNAL_ERROR'
      })
    );
  });

  test('test_async_handler_rejects_logs_error', async () => {
    // Arrange
    const handler = jest.fn(async () => {
      throw new Error('async boom');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('asyncLogger', handler).bind(socket);

    // Act
    const returnedPromise = wrapped();
    await returnedPromise.catch(() => {});
    await new Promise(resolve => setImmediate(resolve));

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      'Async socket handler error',
      expect.objectContaining({ handler: 'asyncLogger', error: 'async boom' })
    );
  });

  test('test_no_args_handler_logs_no_args_preview', () => {
    // Arrange
    const handler = jest.fn(() => {
      throw new Error('oops');
    });
    const socket = makeSocket();
    const wrapped = safeHandler('noArgs', handler).bind(socket);

    // Act
    wrapped();

    // Assert
    const logCall = logger.error.mock.calls[0][1];
    expect(logCall.argPreview).toBe('no args');
  });
});
