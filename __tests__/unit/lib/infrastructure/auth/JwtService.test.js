'use strict';

const JwtService = require('../../../../../lib/infrastructure/auth/JwtService');

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  };
}

function makeService(secret = 'test-secret-key-32-chars-minimum!') {
  process.env.JWT_SECRET = secret;
  const svc = new JwtService(makeLogger());
  delete process.env.JWT_SECRET;
  return svc;
}

const VALID_PAYLOAD = { userId: 'user-123', username: 'alice' };

describe('JwtService', () => {
  describe('generateToken', () => {
    test('test_generateToken_validPayload_returnsString', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      expect(typeof token).toBe('string');
    });

    test('test_generateToken_validPayload_producesThreePartJwt', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    test('test_verifyToken_validToken_returnsDecodedPayload', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const decoded = svc.verifyToken(token);
      expect(decoded.userId).toBe(VALID_PAYLOAD.userId);
      expect(decoded.username).toBe(VALID_PAYLOAD.username);
    });

    test('test_verifyToken_tamperedToken_returnsNull', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const tampered = token.slice(0, -5) + 'xxxxx';
      expect(svc.verifyToken(tampered)).toBeNull();
    });

    test('test_verifyToken_wrongSecret_returnsNull', () => {
      const svc1 = makeService('secret-one-32-chars-padded-here!!');
      const svc2 = makeService('secret-two-32-chars-padded-here!!');
      const token = svc1.generateToken(VALID_PAYLOAD);
      expect(svc2.verifyToken(token)).toBeNull();
    });

    test('test_verifyToken_randomString_returnsNull', () => {
      const svc = makeService();
      expect(svc.verifyToken('not.a.token')).toBeNull();
    });

    test('test_verifyToken_emptyString_returnsNull', () => {
      const svc = makeService();
      expect(svc.verifyToken('')).toBeNull();
    });
  });

  describe('decodeToken', () => {
    test('test_decodeToken_validToken_returnsPayloadWithoutVerification', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const decoded = svc.decodeToken(token);
      expect(decoded.userId).toBe(VALID_PAYLOAD.userId);
    });

    test('test_decodeToken_tokenFromOtherSecret_stillDecodes', () => {
      const svc1 = makeService('secret-alpha-32-chars-padded!!!');
      const svc2 = makeService('secret-beta-32-chars-padded!!!!');
      const token = svc1.generateToken(VALID_PAYLOAD);
      // decodeToken does not verify signature
      const decoded = svc2.decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.userId).toBe(VALID_PAYLOAD.userId);
    });
  });

  describe('socketMiddleware', () => {
    function makeSocket(token) {
      return {
        id: 'sock-1',
        handshake: { auth: { token } }
      };
    }

    test('test_socketMiddleware_noToken_callsNextWithError', () => {
      const svc = makeService();
      const middleware = svc.socketMiddleware();
      const socket = makeSocket(undefined);
      const next = jest.fn();
      middleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('test_socketMiddleware_validToken_callsNextWithNoArgs', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const middleware = svc.socketMiddleware();
      const socket = makeSocket(token);
      const next = jest.fn();
      middleware(socket, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('test_socketMiddleware_validToken_attachesUserDataToSocket', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const middleware = svc.socketMiddleware();
      const socket = makeSocket(token);
      const next = jest.fn();
      middleware(socket, next);
      expect(socket.userId).toBe(VALID_PAYLOAD.userId);
      expect(socket.username).toBe(VALID_PAYLOAD.username);
    });

    test('test_socketMiddleware_invalidToken_callsNextWithError', () => {
      const svc = makeService();
      const middleware = svc.socketMiddleware();
      const socket = makeSocket('bad.token.value');
      const next = jest.fn();
      middleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('expressMiddleware', () => {
    function makeReq(authHeader) {
      return { headers: { authorization: authHeader } };
    }

    function makeRes() {
      const res = { status: jest.fn(), json: jest.fn() };
      res.status.mockReturnValue(res);
      return res;
    }

    test('test_expressMiddleware_noHeader_returns401', () => {
      const svc = makeService();
      const middleware = svc.expressMiddleware();
      const req = { headers: {} };
      const res = makeRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('test_expressMiddleware_malformedHeader_returns401', () => {
      const svc = makeService();
      const middleware = svc.expressMiddleware();
      const req = makeReq('InvalidFormat');
      const res = makeRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('test_expressMiddleware_invalidToken_returns401', () => {
      const svc = makeService();
      const middleware = svc.expressMiddleware();
      const req = makeReq('Bearer bad.token.here');
      const res = makeRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('test_expressMiddleware_validToken_callsNext', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const middleware = svc.expressMiddleware();
      const req = makeReq(`Bearer ${token}`);
      const res = makeRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('test_expressMiddleware_validToken_attachesUserToRequest', () => {
      const svc = makeService();
      const token = svc.generateToken(VALID_PAYLOAD);
      const middleware = svc.expressMiddleware();
      const req = makeReq(`Bearer ${token}`);
      const res = makeRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(req.userId).toBe(VALID_PAYLOAD.userId);
      expect(req.username).toBe(VALID_PAYLOAD.username);
    });
  });
});
