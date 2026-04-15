/**
 * Unit tests for lib/infrastructure/validation/schemas.js — Joi schemas + helpers.
 */

const schemas = require('../../../lib/infrastructure/validation/schemas');

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('playerReadySchema', () => {
  test('accepts valid nickname + uuid playerId', () => {
    const { error } = schemas.validate(schemas.playerReadySchema, {
      nickname: 'bob_42', playerId: VALID_UUID
    });
    expect(error).toBeUndefined();
  });

  test('rejects nickname too short', () => {
    const { error } = schemas.validate(schemas.playerReadySchema, {
      nickname: 'x', playerId: VALID_UUID
    });
    expect(error.details[0].message).toMatch(/at least 2/);
  });

  test('rejects nickname with invalid characters', () => {
    const { error } = schemas.validate(schemas.playerReadySchema, {
      nickname: 'bob!', playerId: VALID_UUID
    });
    expect(error.details[0].message).toMatch(/letters, numbers/);
  });

  test('rejects non-UUID playerId', () => {
    const { error } = schemas.validate(schemas.playerReadySchema, {
      nickname: 'bob', playerId: 'not-a-uuid'
    });
    expect(error).toBeDefined();
  });
});

describe('playerActionSchema', () => {
  test('accepts valid movement + shooting', () => {
    const { error } = schemas.validate(schemas.playerActionSchema, {
      movement: { up: true, down: false, left: false, right: false },
      shooting: true,
      mouseAngle: Math.PI
    });
    expect(error).toBeUndefined();
  });

  test('mouseAngle=null is allowed', () => {
    const { error } = schemas.validate(schemas.playerActionSchema, {
      movement: { up: false, down: false, left: false, right: false },
      shooting: false,
      mouseAngle: null
    });
    expect(error).toBeUndefined();
  });

  test('allows unknown fields (backward compat)', () => {
    const { error, value } = schemas.validate(schemas.playerActionSchema, {
      movement: { up: false, down: false, left: false, right: false },
      shooting: false,
      extraField: 'kept'
    });
    expect(error).toBeUndefined();
    expect(value.extraField).toBe('kept');
  });
});

describe('playerMovementSchema', () => {
  test('accepts x/y with optional velocities', () => {
    const { error } = schemas.validate(schemas.playerMovementSchema, {
      x: 500, y: 500
    });
    expect(error).toBeUndefined();
  });

  test('rejects out-of-bounds coordinates', () => {
    const { error } = schemas.validate(schemas.playerMovementSchema, {
      x: 99999, y: 0
    });
    expect(error).toBeDefined();
  });
});

describe('playerShootingSchema', () => {
  test('accepts valid angle + x/y', () => {
    const { error } = schemas.validate(schemas.playerShootingSchema, {
      angle: 1.5, x: 100, y: 200
    });
    expect(error).toBeUndefined();
  });

  test('rejects angle > 2PI', () => {
    const { error } = schemas.validate(schemas.playerShootingSchema, {
      angle: 10, x: 100, y: 200
    });
    expect(error).toBeDefined();
  });
});

describe('reconnectSchema', () => {
  test('requires both UUIDs', () => {
    const { error } = schemas.validate(schemas.reconnectSchema, {
      sessionId: VALID_UUID, playerId: VALID_UUID
    });
    expect(error).toBeUndefined();
  });

  test('rejects missing sessionId', () => {
    const { error } = schemas.validate(schemas.reconnectSchema, {
      playerId: VALID_UUID
    });
    expect(error).toBeDefined();
  });
});

describe('upgradeSchema', () => {
  test('accepts one of 4 upgrade types', () => {
    for (const t of ['health', 'speed', 'fireRate', 'damage']) {
      const { error } = schemas.validate(schemas.upgradeSchema, {
        upgradeType: t, playerId: VALID_UUID
      });
      expect(error).toBeUndefined();
    }
  });

  test('rejects unknown upgrade type', () => {
    const { error } = schemas.validate(schemas.upgradeSchema, {
      upgradeType: 'luck', playerId: VALID_UUID
    });
    expect(error).toBeDefined();
  });
});

describe('createPlayerSchema', () => {
  test('validates username pattern', () => {
    const { error } = schemas.validate(schemas.createPlayerSchema, { username: 'good_name' });
    expect(error).toBeUndefined();
  });

  test('rejects invalid chars', () => {
    const { error } = schemas.validate(schemas.createPlayerSchema, { username: 'bad name!' });
    expect(error).toBeDefined();
  });
});

describe('submitScoreSchema', () => {
  const valid = {
    playerId: VALID_UUID, wave: 5, level: 3,
    kills: 100, survivalTime: 60000, score: 50000
  };

  test('accepts valid submission', () => {
    expect(schemas.validate(schemas.submitScoreSchema, valid).error).toBeUndefined();
  });

  test('rejects negative values', () => {
    const { error } = schemas.validate(schemas.submitScoreSchema, { ...valid, kills: -1 });
    expect(error).toBeDefined();
  });

  test('rejects survivalTime > 24h', () => {
    const { error } = schemas.validate(schemas.submitScoreSchema, { ...valid, survivalTime: 90000000 });
    expect(error).toBeDefined();
  });
});

describe('leaderboardQuerySchema', () => {
  test('applies default limit of 10', () => {
    const { value } = schemas.validate(schemas.leaderboardQuerySchema, {});
    expect(value.limit).toBe(10);
  });

  test('rejects limit > 100', () => {
    const { error } = schemas.validate(schemas.leaderboardQuerySchema, { limit: 200 });
    expect(error).toBeDefined();
  });
});

describe('buyUpgradeSchema', () => {
  test('accepts level 1..10', () => {
    const { error } = schemas.validate(schemas.buyUpgradeSchema, { upgradeType: 'damage', level: 5 });
    expect(error).toBeUndefined();
  });

  test('rejects level 11', () => {
    const { error } = schemas.validate(schemas.buyUpgradeSchema, { upgradeType: 'damage', level: 11 });
    expect(error).toBeDefined();
  });
});

describe('validate helper', () => {
  test('returns all errors (abortEarly:false)', () => {
    const { error } = schemas.validate(schemas.submitScoreSchema, {
      wave: -1, level: -1, kills: -1 // multiple errors + missing playerId
    });
    expect(error.details.length).toBeGreaterThan(1);
  });

  test('strips unknown fields', () => {
    const { value } = schemas.validate(schemas.createPlayerSchema, {
      username: 'bob', sneaky: 'removed'
    });
    expect(value.sneaky).toBeUndefined();
  });
});

describe('validateMiddleware', () => {
  function setupMock() {
    const req = { body: { username: 'bob' } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })), json };
    const next = jest.fn();
    return { req, res, next, json };
  }

  test('calls next and attaches validatedData on success', () => {
    const { req, res, next } = setupMock();
    const mw = schemas.validateMiddleware(schemas.createPlayerSchema);
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.validatedData).toEqual({ username: 'bob' });
  });

  test('responds 400 with details on failure', () => {
    const { res, next, json } = setupMock();
    const req = { body: { username: 'x' } }; // too short
    const mw = schemas.validateMiddleware(schemas.createPlayerSchema);
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Validation failed',
      details: expect.any(Array)
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
