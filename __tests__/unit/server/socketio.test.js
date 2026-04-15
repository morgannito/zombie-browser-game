/**
 * Unit tests for server/socketio.js
 */

jest.mock('../../../middleware/cors', () => ({
  getSocketIOCorsConfig: jest.fn(() => ({ origin: 'test-origin' }))
}));

const mockIoFactory = jest.fn((_httpServer, _opts) => ({ _ioInstance: true }));
jest.mock('socket.io', () => mockIoFactory);

const { createSocketIOServer } = require('../../../server/socketio');
const { getSocketIOCorsConfig } = require('../../../middleware/cors');

describe('createSocketIOServer', () => {
  beforeEach(() => {
    mockIoFactory.mockClear();
    getSocketIOCorsConfig.mockClear();
  });

  test('returns the socket.io server instance', () => {
    const fakeHttp = {};
    const io = createSocketIOServer(fakeHttp);
    expect(io).toEqual({ _ioInstance: true });
  });

  test('passes the http server as first arg', () => {
    const fakeHttp = { __fakeHttp: true };
    createSocketIOServer(fakeHttp);
    expect(mockIoFactory).toHaveBeenCalledWith(fakeHttp, expect.any(Object));
  });

  test('applies CF-friendly options (perMessageDeflate: false, transports)', () => {
    createSocketIOServer({});
    const [, opts] = mockIoFactory.mock.calls[0];
    expect(opts.perMessageDeflate).toBe(false);
    expect(opts.transports).toEqual(['websocket', 'polling']);
    expect(opts.allowUpgrades).toBe(true);
  });

  test('uses tuned ping settings (20s timeout)', () => {
    createSocketIOServer({});
    const [, opts] = mockIoFactory.mock.calls[0];
    expect(opts.pingTimeout).toBe(20000);
    expect(opts.pingInterval).toBe(10000);
  });

  test('pulls CORS config from middleware', () => {
    createSocketIOServer({});
    expect(getSocketIOCorsConfig).toHaveBeenCalled();
    const [, opts] = mockIoFactory.mock.calls[0];
    expect(opts.cors).toEqual({ origin: 'test-origin' });
  });
});
