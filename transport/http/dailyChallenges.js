'use strict';

const express = require('express');
const logger = require('../../infrastructure/logging/Logger');
const { Joi, validateRequest } = require('../../middleware/validation');
const { requireSameUserInParam } = require('../../middleware/authz');

const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });

function initDailyChallengesRoutes(container, options = {}) {
  const router = express.Router();
  const requireAuth = options.requireAuth || ((_req, _res, next) => next());
  const dailyChallengeService = container.get('dailyChallengeService');

  router.use(requireAuth);

  /** GET /api/v1/daily-challenges/:playerId — today's challenges + progress */
  router.get('/:playerId',
    validateRequest({ params: Joi.object({ playerId: uuidSchema.required() }) }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const data = await dailyChallengeService.getTodayChallenges(req.params.playerId);
        res.json({ success: true, data });
      } catch (err) {
        logger.error('GET daily challenges failed', { error: err.message, playerId: req.params.playerId });
        res.status(500).json({ success: false, error: 'Failed to fetch daily challenges' });
      }
    });

  /** POST /api/v1/daily-challenges/:playerId/event — apply a delta event */
  router.post('/:playerId/event',
    validateRequest({
      params: Joi.object({ playerId: uuidSchema.required() }),
      body: Joi.object({ eventType: Joi.string().valid('zombies_killed', 'zombies_killed_type', 'boss_kill', 'survival_time').required(), delta: Joi.number().integer().min(1).default(1), meta: Joi.object().default({}) })
    }),
    requireSameUserInParam('playerId'),
    (req, res) => {
      try {
        const { eventType, delta, meta } = req.body;
        const results = dailyChallengeService.applyEvent(req.params.playerId, eventType, delta, meta);
        res.json({ success: true, data: results });
      } catch (err) {
        logger.error('POST daily event failed', { error: err.message });
        res.status(500).json({ success: false, error: 'Failed to apply event' });
      }
    });

  /** POST /api/v1/daily-challenges/:playerId/claim — atomic reward claim */
  router.post('/:playerId/claim',
    validateRequest({
      params: Joi.object({ playerId: uuidSchema.required() }),
      body: Joi.object({ challengeId: Joi.string().required() })
    }),
    requireSameUserInParam('playerId'),
    (req, res) => {
      try {
        const reward = dailyChallengeService.claimReward(req.params.playerId, req.body.challengeId);
        if (!reward) {
return res.status(409).json({ success: false, error: 'Not claimable (already claimed or not completed)' });
}
        res.json({ success: true, data: { reward } });
      } catch (err) {
        logger.error('POST daily claim failed', { error: err.message });
        res.status(500).json({ success: false, error: 'Failed to claim reward' });
      }
    });

  return router;
}

module.exports = initDailyChallengesRoutes;
