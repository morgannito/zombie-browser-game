jest.mock('../../../infrastructure/logging/Logger', () => ({
  warn: jest.fn()
}));

const logger = require('../../../infrastructure/logging/Logger');
const { RATE_LIMIT_CONFIG } = require('../../../config/constants');
const { checkRateLimit, cleanupRateLimits } = require('../../../sockets/rateLimitStore');

describe('rateLimitStore', () => {
  afterEach(() => {
    cleanupRateLimits('socket-1');
    cleanupRateLimits('socket-2');
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('allows events without configured rate limit', () => {
    expect(checkRateLimit('socket-1', 'unknownEvent')).toBe(true);
  });

  test('blocks requests after configured limit and logs warning', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const shootLimit = RATE_LIMIT_CONFIG.shoot.maxRequests;

    for (let i = 0; i < shootLimit; i++) {
      expect(checkRateLimit('socket-1', 'shoot')).toBe(true);
    }

    expect(checkRateLimit('socket-1', 'shoot')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rate limit exceeded',
      expect.objectContaining({
        socketId: 'socket-1',
        event: 'shoot',
        limit: shootLimit
      })
    );
  });

  test('resets counter when request lands at window boundary', () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const shootLimit = RATE_LIMIT_CONFIG.shoot.maxRequests;
    const shootWindowMs = RATE_LIMIT_CONFIG.shoot.windowMs;

    for (let i = 0; i < shootLimit; i++) {
      expect(checkRateLimit('socket-2', 'shoot')).toBe(true);
    }
    expect(checkRateLimit('socket-2', 'shoot')).toBe(false);

    now = 1000 + shootWindowMs; // exact boundary for the active shoot window
    expect(checkRateLimit('socket-2', 'shoot')).toBe(true);
  });

  test('cleanup removes socket counters', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const shootLimit = RATE_LIMIT_CONFIG.shoot.maxRequests;

    for (let i = 0; i < shootLimit; i++) {
      expect(checkRateLimit('socket-1', 'shoot')).toBe(true);
    }
    expect(checkRateLimit('socket-1', 'shoot')).toBe(false);

    cleanupRateLimits('socket-1');
    expect(checkRateLimit('socket-1', 'shoot')).toBe(true);
  });
});
