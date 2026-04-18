'use strict';

process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');

const VALID_UUID = 'c1b2c3d4-e5f6-4a7b-8c9d-000000000001';
const OTHER_UUID = 'c1b2c3d4-e5f6-4a7b-8c9d-000000000002';

function makeFakeProgression(overrides = {}) {
  return {
    toObject: jest.fn().mockReturnValue({ playerId: VALID_UUID, accountLevel: 5 }),
    getStats: jest.fn().mockReturnValue({ accountLevel: 5, totalXPEarned: 500, skillPoints: 3 }),
    addXP: jest.fn().mockReturnValue({ levelsGained: 1, newLevel: 6 }),
    hasSkill: jest.fn().mockReturnValue(true),
    unlockSkill: jest.fn(),
    prestige: jest.fn().mockReturnValue({ tokensEarned: 2, newPrestigeLevel: 1 }),
    skillPoints: 3,
    unlockedSkills: [],
    ...overrides
  };
}

function buildApp(repoOverrides = {}, options = {}) {
  jest.resetModules();

  const fakeProgression = options.fakeProgression || makeFakeProgression();

  const mockRepoInstance = {
    getAllSkills: jest.fn().mockResolvedValue([{ id: 'sk1', category: 'combat', tier: 1 }]),
    getTopByLevel: jest.fn().mockResolvedValue([
      { username: 'Alice', progression: { accountLevel: 10, totalXPEarned: 1000, prestigeLevel: 0 } }
    ]),
    getTopByPrestige: jest.fn().mockResolvedValue([
      { username: 'Bob', progression: { prestigeLevel: 2, prestigeTokens: 5, accountLevel: 50 } }
    ]),
    findByPlayerId: jest.fn().mockResolvedValue(fakeProgression),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    getSkillById: jest.fn().mockResolvedValue({ id: 'sk1', cost: 1, prerequisites: [] }),
    ...repoOverrides
  };

  jest.doMock('../../../lib/infrastructure/repositories/SQLiteProgressionRepository', () =>
    jest.fn().mockImplementation(() => mockRepoInstance)
  );
  jest.doMock('../../../lib/domain/entities/AccountProgression', () =>
    jest.fn().mockImplementation(() => fakeProgression)
  );

  const app = express();
  app.use(express.json());
  const container = {
    get: (key) => {
      if (key === 'database') {
return {};
}
      throw new Error('not registered');
    }
  };
  const injectUserId = (req, _res, next) => {
 req.userId = VALID_UUID; next();
};
  const initProgressionRoutes = require('../../../transport/http/progression');
  const router = initProgressionRoutes(container, { requireAuth: injectUserId });
  app.use('/', router);
  return { app, mockRepoInstance };
}

describe('GET /skills/all', () => {
  test('returns_skill_tree_grouped_by_category', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/skills/all');
    expect(res.status).toBe(200);
  });

  test('response_contains_grouped_and_skills_keys', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/skills/all');
    expect(res.body.data).toHaveProperty('grouped');
  });

  test('returns_500_when_repo_throws', async () => {
    const { app } = buildApp({ getAllSkills: jest.fn().mockRejectedValue(new Error('DB')) });
    const res = await request(app).get('/skills/all');
    expect(res.status).toBe(500);
  });
});

describe('GET /leaderboard/level', () => {
  test('returns_top_players_by_level_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/leaderboard/level');
    expect(res.status).toBe(200);
  });

  test('entries_have_rank_and_username', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/leaderboard/level');
    expect(res.body.data[0]).toHaveProperty('rank');
  });

  test('accepts_custom_limit_query_param', async () => {
    const { app, mockRepoInstance } = buildApp();
    await request(app).get('/leaderboard/level?limit=5');
    expect(mockRepoInstance.getTopByLevel).toHaveBeenCalledWith(5);
  });

  test('returns_400_when_limit_exceeds_100', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/leaderboard/level?limit=200');
    expect(res.status).toBe(400);
  });
});

describe('GET /leaderboard/prestige', () => {
  test('returns_top_players_by_prestige_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/leaderboard/prestige');
    expect(res.status).toBe(200);
  });

  test('entries_have_prestige_level', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/leaderboard/prestige');
    expect(res.body.data[0]).toHaveProperty('prestigeLevel');
  });
});

describe('GET /:playerId', () => {
  test('returns_player_progression_success', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  test('creates_progression_when_not_found', async () => {
    const { app, mockRepoInstance } = buildApp({ findByPlayerId: jest.fn().mockResolvedValue(null) });
    const res = await request(app).get(`/${VALID_UUID}`);
    expect(res.status).toBe(200);
    expect(mockRepoInstance.create).toHaveBeenCalled();
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
});

describe('POST /:playerId/add-xp', () => {
  test('adds_xp_and_returns_result_success', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/add-xp`).send({ xp: 100 });
    expect(res.status).toBe(200);
  });

  test('returns_400_when_xp_missing', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/add-xp`).send({});
    expect(res.status).toBe(400);
  });

  test('returns_400_when_xp_negative', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/add-xp`).send({ xp: -10 });
    expect(res.status).toBe(400);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${OTHER_UUID}/add-xp`).send({ xp: 50 });
    expect(res.status).toBe(403);
  });
});

describe('POST /:playerId/unlock-skill', () => {
  test('unlocks_skill_and_returns_success', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/unlock-skill`).send({ skillId: 'sk1' });
    expect(res.status).toBe(200);
  });

  test('returns_404_when_progression_not_found', async () => {
    const { app } = buildApp({ findByPlayerId: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post(`/${VALID_UUID}/unlock-skill`).send({ skillId: 'sk1' });
    expect(res.status).toBe(404);
  });

  test('returns_404_when_skill_not_found', async () => {
    const { app } = buildApp({ getSkillById: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post(`/${VALID_UUID}/unlock-skill`).send({ skillId: 'sk1' });
    expect(res.status).toBe(404);
  });

  test('returns_400_when_prerequisite_not_unlocked', async () => {
    const fakeProgression = makeFakeProgression({ hasSkill: jest.fn().mockReturnValue(false) });
    const { app } = buildApp(
      { getSkillById: jest.fn().mockResolvedValue({ id: 'sk2', cost: 1, prerequisites: ['sk0'] }) },
      { fakeProgression }
    );
    const res = await request(app).post(`/${VALID_UUID}/unlock-skill`).send({ skillId: 'sk2' });
    expect(res.status).toBe(400);
  });

  test('returns_400_when_skillId_missing', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/unlock-skill`).send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /:playerId/prestige', () => {
  test('prestige_and_returns_tokens_earned', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${VALID_UUID}/prestige`).send({});
    expect(res.status).toBe(200);
  });

  test('returns_404_when_progression_not_found', async () => {
    const { app } = buildApp({ findByPlayerId: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post(`/${VALID_UUID}/prestige`).send({});
    expect(res.status).toBe(404);
  });

  test('returns_403_when_userId_mismatch', async () => {
    const { app } = buildApp();
    const res = await request(app).post(`/${OTHER_UUID}/prestige`).send({});
    expect(res.status).toBe(403);
  });

  test('returns_400_when_prestige_domain_throws', async () => {
    const fakeProgression = makeFakeProgression({
      prestige: jest.fn().mockImplementation(() => {
 throw new Error('Not enough level');
})
    });
    const { app } = buildApp({}, { fakeProgression });
    const res = await request(app).post(`/${VALID_UUID}/prestige`).send({});
    expect(res.status).toBe(400);
  });
});
