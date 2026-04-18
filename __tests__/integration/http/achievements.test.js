'use strict';

process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');

const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001';
const OTHER_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002';

function buildApp(repoMethods = {}, serviceMethods = {}) {
  const app = express();
  app.use(express.json());

  const mockRepo = {
    getAllAchievements: jest.fn().mockResolvedValue([{ toObject: () => ({ id: 'ach1', name: 'First Kill' }) }]),
    getPlayerAchievements: jest.fn().mockResolvedValue([{ id: 'ach1', unlockedAt: '2024-01-01' }]),
    ...repoMethods
  };
  const mockService = {
    getPlayerAchievementProgress: jest.fn().mockResolvedValue({ total: 10, unlocked: 3 }),
    checkAndUnlockAchievements: jest.fn().mockResolvedValue([{ toObject: () => ({ id: 'ach2', name: 'Survivor' }) }]),
    ...serviceMethods
  };
  const container = {
    get: (key) => key === 'achievementService' ? mockService : null,
    getRepository: () => mockRepo
  };

  const injectUserId = (req, _res, next) => {
 req.userId = VALID_UUID; next();
};
  // Use a fresh express.Router by resetting module cache
  jest.resetModules();
  const freshInit = require('../../../transport/http/achievements');
  const router = freshInit(container, { requireAuth: injectUserId });
  app.use('/', router);
  return { app, mockRepo, mockService };
}

describe('GET /all', () => {
  test('returns_all_achievements_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/all');
    expect(res.status).toBe(200);
  });

  test('returns_success_true_with_data_array', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/all');
    expect(res.body.success).toBe(true);
  });

  test('returns_500_when_repo_throws', async () => {
    const { app } = buildApp({ getAllAchievements: jest.fn().mockRejectedValue(new Error('DB error')) });
    const res = await request(app).get('/all');
    expect(res.status).toBe(500);
  });
});

describe('GET /:playerId', () => {
  test('returns_player_achievements_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${OTHER_UUID}`);
    expect(res.status).toBe(403);
  });

  test('returns_400_when_playerId_not_uuid', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/not-a-uuid');
    expect(res.status).toBe(400);
  });

  test('returns_500_when_repo_throws', async () => {
    const { app } = buildApp({ getPlayerAchievements: jest.fn().mockRejectedValue(new Error('DB')) });
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /:playerId/progress', () => {
  test('returns_progress_data_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${VALID_UUID}/progress`);
    expect(res.status).toBe(200);
  });

  test('returns_success_true_with_progress_object', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${VALID_UUID}/progress`);
    expect(res.body.data).toHaveProperty('total');
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${OTHER_UUID}/progress`);
    expect(res.status).toBe(403);
  });
});

describe('POST /:playerId/check', () => {
  test('returns_newly_unlocked_achievements_success', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/check`).send({ sessionStats: { kills: 5 } });
    expect(res.status).toBe(200);
  });

  test('returns_count_of_unlocked_achievements', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/check`).send({});
    expect(res.body.data).toHaveProperty('count');
  });

  test('returns_200_with_empty_body_using_defaults', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/check`).send({});
    expect(res.body.success).toBe(true);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${OTHER_UUID}/check`).send({});
    expect(res.status).toBe(403);
  });

  test('returns_500_when_service_throws', async () => {
    const { app } = buildApp({}, { checkAndUnlockAchievements: jest.fn().mockRejectedValue(new Error('fail')) });
    const res = await request(app).post(`/${VALID_UUID}/check`).send({});
    expect(res.status).toBe(500);
  });
});
