jest.mock('../../../infrastructure/logging/Logger', () => ({
  warn: jest.fn()
}));

const logger = require('../../../infrastructure/logging/Logger');
const { checkRateLimit, cleanupRateLimits } = require('../../../sockets/rateLimitStore');

// TODO: rate limits globally disabled (RATE_LIMITS_DISABLED=true in rateLimitStore.js) - re-enable when shoot rate limiting is re-activated
describe.skip('rateLimitStore', () => {
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

    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('socket-1', 'shoot')).toBe(true);
    }

    expect(checkRateLimit('socket-1', 'shoot')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rate limit exceeded',
      expect.objectContaining({
        socketId: 'socket-1',
        event: 'shoot',
        limit: 20
      })
    );
  });

  test('resets counter when request lands at window boundary', () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('socket-2', 'shoot')).toBe(true);
    }
    expect(checkRateLimit('socket-2', 'shoot')).toBe(false);

    now = 2000; // exact boundary for shoot window (1000ms)
    expect(checkRateLimit('socket-2', 'shoot')).toBe(true);
  });

  test('cleanup removes socket counters', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('socket-1', 'shoot')).toBe(true);
    }
    expect(checkRateLimit('socket-1', 'shoot')).toBe(false);

    cleanupRateLimits('socket-1');
    expect(checkRateLimit('socket-1', 'shoot')).toBe(true);
  });
});
