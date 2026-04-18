'use strict';

process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');
const initDailyChallengesRoutes = require('../../../transport/http/dailyChallenges');

const VALID_UUID = 'b1b2c3d4-e5f6-4a7b-8c9d-000000000001';
const OTHER_UUID = 'b1b2c3d4-e5f6-4a7b-8c9d-000000000002';

function buildApp(serviceOverrides = {}) {
  const app = express();
  app.use(express.json());

  const mockService = {
    getTodayChallenges: jest.fn().mockResolvedValue([{ id: 'ch1', type: 'zombies_killed', target: 10, progress: 0 }]),
    applyEvent: jest.fn().mockReturnValue({ updated: true }),
    claimReward: jest.fn().mockReturnValue({ xp: 100, coins: 50 }),
    ...serviceOverrides
  };
  const container = { get: () => mockService };
  const injectUserId = (req, _res, next) => {
 req.userId = VALID_UUID; next();
};
  const router = initDailyChallengesRoutes(container, { requireAuth: injectUserId });
  app.use('/', router);
  return { app, mockService };
}

describe('GET /:playerId', () => {
  test('returns_todays_challenges_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  test('returns_success_true_with_data', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.body.success).toBe(true);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${OTHER_UUID}`);
    expect(res.status).toBe(403);
  });

  test('returns_400_when_playerId_not_uuid', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/invalid-id');
    expect(res.status).toBe(400);
  });

  test('returns_500_when_service_throws', async () => {
    const { app } = buildApp({ getTodayChallenges: jest.fn().mockRejectedValue(new Error('DB fail')) });
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(500);
  });
});

describe('POST /:playerId/event', () => {
  const validBody = { eventType: 'zombies_killed', delta: 3, meta: {} };

  test('applies_event_and_returns_success', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/event`).send(validBody);
    expect(res.status).toBe(200);
  });

  test('returns_400_when_eventType_invalid', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/event`).send({ eventType: 'invalid_type', delta: 1 });
    expect(res.status).toBe(400);
  });

  test('returns_400_when_delta_zero', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/event`).send({ eventType: 'zombies_killed', delta: 0 });
    expect(res.status).toBe(400);
  });

  test('returns_400_when_eventType_missing', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/event`).send({ delta: 1 });
    expect(res.status).toBe(400);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${OTHER_UUID}/event`).send(validBody);
    expect(res.status).toBe(403);
  });

  test('uses_default_delta_1_when_not_provided', async () => {
    const { app, mockService } = buildApp();
    await request(app).post(`/${VALID_UUID}/event`).send({ eventType: 'boss_kill' });
    expect(mockService.applyEvent).toHaveBeenCalledWith(VALID_UUID, 'boss_kill', 1, {});
  });
});

describe('POST /:playerId/claim', () => {
  test('claims_reward_and_returns_success', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/claim`).send({ challengeId: 'ch1' });
    expect(res.status).toBe(200);
  });

  test('returns_409_when_reward_not_claimable', async () => {
    const { app } = buildApp({ claimReward: jest.fn().mockReturnValue(null) });
    const res = await request(app).post(`/${VALID_UUID}/claim`).send({ challengeId: 'ch1' });
    expect(res.status).toBe(409);
  });

  test('returns_400_when_challengeId_missing', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/claim`).send({});
    expect(res.status).toBe(400);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${OTHER_UUID}/claim`).send({ challengeId: 'ch1' });
    expect(res.status).toBe(403);
  });
});
