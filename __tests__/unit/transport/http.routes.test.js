/**
 * Unit tests for transport/http routes: auth, leaderboard, players
 * Focus: happy paths + key edge cases (validation, error handling)
 *
 * NOTE: auth.js / leaderboard.js / players.js use a module-level Express router,
 * so each test suite isolates modules to get a fresh router instance.
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../../middleware/security', () => ({
  configureAuthLimiter: () => (_req, _res, next) => next(),
  requireMetricsToken: (_req, _res, next) => next()
}));

const request = require('supertest');
const express = require('express');

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function buildApp(router, path = '/') {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
}

// ─── auth ────────────────────────────────────────────────────────────────────

describe('POST /login (auth)', () => {
  let initAuthRoutes;

  beforeEach(() => {
    jest.isolateModules(() => {
      initAuthRoutes = require('../../../transport/http/auth');
    });
  });

  test('happy path — returns token and player object', async () => {
    const jwtService = { generateToken: jest.fn(() => 'tok123') };
    const container = { get: jest.fn(() => ({ execute: jest.fn().mockResolvedValue({}) })) };
    const app = buildApp(initAuthRoutes(container, jwtService));

    const res = await request(app).post('/login').send({ username: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token', 'tok123');
    expect(res.body.player).toMatchObject({ username: 'Alice', highScore: 0 });
  });

  test('rejects username shorter than 2 chars', async () => {
    const jwtService = { generateToken: jest.fn(() => 'tok') };
    const app = buildApp(initAuthRoutes(null, jwtService));

    const res = await request(app).post('/login').send({ username: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('USERNAME_INVALID');
  });

  test('rejects username with invalid characters', async () => {
    const jwtService = { generateToken: jest.fn(() => 'tok') };
    const app = buildApp(initAuthRoutes(null, jwtService));

    const res = await request(app).post('/login').send({ username: 'héros!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('USERNAME_CHARS_INVALID');
  });

  test('returns 500 when jwtService throws', async () => {
    const badJwt = { generateToken: jest.fn(() => {
 throw new Error('jwt fail');
}) };
    const app = buildApp(initAuthRoutes(null, badJwt));

    const res = await request(app).post('/login').send({ username: 'Bob' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('LOGIN_FAILED');
  });
});

// ─── leaderboard GET ─────────────────────────────────────────────────────────

describe('GET / (leaderboard)', () => {
  let initLeaderboardRoutes;
  let app;
  let mockExecute;

  beforeEach(() => {
    jest.isolateModules(() => {
      initLeaderboardRoutes = require('../../../transport/http/leaderboard');
    });
    mockExecute = jest.fn().mockResolvedValue({ entries: [], total: 0 });
    const container = { get: jest.fn(() => ({ execute: mockExecute })) };
    app = buildApp(initLeaderboardRoutes(container));
  });

  test('happy path — returns leaderboard result', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith({ limit: 10, playerId: null });
  });

  test('passes limit query param', async () => {
    const res = await request(app).get('/?limit=5');
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
  });

  test('rejects limit > 100', async () => {
    const res = await request(app).get('/?limit=999');
    expect(res.status).toBe(400);
  });
});

// ─── leaderboard POST ────────────────────────────────────────────────────────

describe('POST / (leaderboard score submission)', () => {
  let initLeaderboardRoutes;
  let app;
  let mockExecute;

  const validPayload = {
    playerId: VALID_UUID,
    wave: 3,
    level: 2,
    kills: 10,
    survivalTime: 120
  };

  beforeEach(() => {
    jest.isolateModules(() => {
      initLeaderboardRoutes = require('../../../transport/http/leaderboard');
    });
    mockExecute = jest.fn().mockResolvedValue({
      toObject: () => ({ ...validPayload, score: 500 })
    });
    const container = { get: jest.fn(() => ({ execute: mockExecute })) };
    app = buildApp(initLeaderboardRoutes(container, {
      requireAuth: (req, _res, next) => {
 req.userId = VALID_UUID; next();
}
    }));
  });

  test('happy path — returns 201 with entry', async () => {
    const res = await request(app).post('/').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('score', 500);
  });

  test('rejects payload missing required fields', async () => {
    const res = await request(app).post('/').send({ playerId: VALID_UUID });
    expect(res.status).toBe(400);
  });
});

// ─── players ─────────────────────────────────────────────────────────────────

describe('GET /:id (players)', () => {
  let initPlayerRoutes;
  let app;

  beforeEach(() => {
    jest.isolateModules(() => {
      initPlayerRoutes = require('../../../transport/http/players');
    });
    const fakePlayer = { toObject: () => ({ id: VALID_UUID, username: 'Alice' }) };
    const playerRepo = {
      getStats: jest.fn().mockResolvedValue({ kills: 5 }),
      findById: jest.fn().mockResolvedValue(fakePlayer)
    };
    const container = {
      get: jest.fn(),
      getRepository: jest.fn(() => playerRepo)
    };
    app = buildApp(initPlayerRoutes(container, {
      requireAuth: (req, _res, next) => {
 req.userId = VALID_UUID; next();
}
    }), '/');
  });

  test('happy path — returns player stats', async () => {
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.player).toMatchObject({ id: VALID_UUID });
    expect(res.body.stats).toMatchObject({ kills: 5 });
  });

  test('rejects non-UUID id', async () => {
    const res = await request(app).get('/not-a-uuid');
    expect(res.status).toBe(400);
  });
});
