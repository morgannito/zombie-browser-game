'use strict';

const {
  requireSameUserInParam,
  requireSameUserInBody,
  requireSameUserInQuery
} = require('../../../middleware/authz');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('authz middleware', () => {
  describe('requireSameUserInParam', () => {
    test('matching userId calls next', () => {
      const req = { params: { id: 'user-abc' }, userId: 'user-abc' };
      const next = jest.fn();
      requireSameUserInParam()(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    test('mismatched userId returns 403', () => {
      const req = { params: { id: 'user-other' }, userId: 'user-abc' };
      const res = makeRes();
      requireSameUserInParam()(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('missing param returns 403', () => {
      const req = { params: {}, userId: 'user-abc' };
      const res = makeRes();
      requireSameUserInParam()(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireSameUserInBody', () => {
    test('matching playerId calls next', () => {
      const req = { body: { playerId: 'user-abc' }, userId: 'user-abc' };
      const next = jest.fn();
      requireSameUserInBody()(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    test('missing playerId returns 400', () => {
      const req = { body: {}, userId: 'user-abc' };
      const res = makeRes();
      requireSameUserInBody()(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('mismatched playerId returns 403', () => {
      const req = { body: { playerId: 'user-other' }, userId: 'user-abc' };
      const res = makeRes();
      requireSameUserInBody()(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireSameUserInQuery', () => {
    test('absent field is a no-op', () => {
      const req = { query: {}, userId: 'user-abc' };
      const next = jest.fn();
      requireSameUserInQuery()(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    test('matching field calls next', () => {
      const req = { query: { playerId: 'user-abc' }, userId: 'user-abc' };
      const next = jest.fn();
      requireSameUserInQuery()(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    test('mismatched field returns 403', () => {
      const req = { query: { playerId: 'user-other' }, userId: 'user-abc' };
      const res = makeRes();
      requireSameUserInQuery()(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
