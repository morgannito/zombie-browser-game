/**
 * @fileoverview Player routes
 * @description Handles player operations
 * - GET /api/players/:id - Get player stats
 * - POST /api/players - Create new player
 * - GET /api/players/:id/upgrades - Get player upgrades
 * - POST /api/players/:id/upgrades - Buy permanent upgrade
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandlers');
const { Joi, validateRequest } = require('../../middleware/validation');
const { requireSameUserInParam, requireSameUserInBody } = require('../../middleware/authz');

/**
 * Initialize player routes
 * @param {Object} container - Dependency injection container
 * @returns {Router} Express router
 */
function initPlayerRoutes(container, options = {}) {
  const requireAuth = options.requireAuth || ((_req, _res, next) => next());
  const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });

  router.use(requireAuth);

  /**
   * GET /api/players/:id - Get player stats
   */
  router.get(
    '/:id',
    validateRequest({
      params: Joi.object({
        id: uuidSchema.required()
      })
    }),
    requireSameUserInParam('id'),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const playerRepo = container.getRepository('player');

      const stats = await playerRepo.getStats(id); // Will throw NotFoundError if player doesn't exist
      const player = await playerRepo.findById(id);
      if (!player) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Player not found' });
      }

      res.json({ player: player.toObject(), stats });
    })
  );

  /**
   * POST /api/players - Create player
   */
  router.post(
    '/',
    validateRequest({
      body: Joi.object({
        id: uuidSchema.required(),
        username: Joi.string().trim().min(2).max(20).required()
      })
    }),
    requireSameUserInBody('id'),
    asyncHandler(async (req, res) => {
      const { id, username } = req.body;
      const createPlayer = container.get('createPlayerUseCase');

      const player = await createPlayer.execute({ id, username });
      res.status(201).json(player.toObject());
    })
  );

  /**
   * GET /api/players/:id/upgrades - Get player upgrades
   */
  router.get(
    '/:id/upgrades',
    validateRequest({
      params: Joi.object({
        id: uuidSchema.required()
      })
    }),
    requireSameUserInParam('id'),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const getUpgrades = container.get('getUpgradesUseCase');

      const result = await getUpgrades.execute({ playerId: id });
      res.json(result);
    })
  );

  /**
   * POST /api/players/:id/upgrades - Buy permanent upgrade
   */
  router.post(
    '/:id/upgrades',
    validateRequest({
      params: Joi.object({
        id: uuidSchema.required()
      }),
      body: Joi.object({
        upgradeName: Joi.string().valid('maxHealth', 'damage', 'speed', 'fireRate').required()
      })
    }),
    requireSameUserInParam('id'),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { upgradeName } = req.body;
      const buyUpgrade = container.get('buyUpgradeUseCase');

      const upgrades = await buyUpgrade.execute({
        playerId: id,
        upgradeName
      });

      res.json(upgrades.toObject());
    })
  );

  return router;
}

module.exports = initPlayerRoutes;
