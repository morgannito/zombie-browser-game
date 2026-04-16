const { EventEmitter } = require('events');

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn()
}));

const logger = require('../../../infrastructure/logging/Logger');
const { accessLogMiddleware, shouldSkipRequest } = require('../../../middleware/accessLog');

function createResponse({ statusCode = 200, contentLength = null } = {}) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.getHeader = name => {
    if (name.toLowerCase() === 'content-length') {
      return contentLength;
    }
    return undefined;
  };
  return res;
}

describe('accessLog middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shouldSkipRequest supports health and metrics paths', () => {
    expect(shouldSkipRequest('/health')).toBe(true);
    expect(shouldSkipRequest('/api/v1/metrics')).toBe(true);
    expect(shouldSkipRequest('/api/v1/metrics?full=true')).toBe(true);
    expect(shouldSkipRequest('/api/v1/players')).toBe(false);
  });

  test('skips logging for health requests', () => {
    const req = {
      originalUrl: '/health',
      method: 'GET',
      path: '/health',
      ip: '127.0.0.1',
      get: () => 'jest'
    };
    const res = createResponse();
    const next = jest.fn();

    accessLogMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('logs structured context for non-skipped requests', () => {
    const req = {
      originalUrl: '/api/players/abc',
      method: 'GET',
      path: '/api/players/abc',
      ip: '127.0.0.1',
      id: 'req-123',
      get: () => 'jest-agent'
    };
    const res = createResponse({ statusCode: 201, contentLength: 456 });
    const next = jest.fn();

    accessLogMiddleware(req, res, next);
    res.emit('finish');

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'HTTP request',
      expect.objectContaining({
        requestId: 'req-123',
        method: 'GET',
        path: '/api/players/abc',
        statusCode: 201,
        responseBytes: 456,
        userAgent: 'jest-agent'
      })
    );
  });
});
