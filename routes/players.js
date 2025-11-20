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
const { asyncHandler } = require('../middleware/errorHandlers');

/**
 * Initialize player routes
 * @param {Object} container - Dependency injection container
 * @returns {Router} Express router
 */
function initPlayerRoutes(container) {
  /**
   * GET /api/players/:id - Get player stats
   */
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const playerRepo = container.getRepository('player');

    const stats = await playerRepo.getStats(id); // Will throw NotFoundError if player doesn't exist
    const player = await playerRepo.findById(id);

    res.json({ player: player.toObject(), stats });
  }));

  /**
   * POST /api/players - Create player
   */
  router.post('/', asyncHandler(async (req, res) => {
    const { id, username } = req.body;
    const createPlayer = container.get('createPlayer');

    const player = await createPlayer.execute({ id, username });
    res.status(201).json(player.toObject());
  }));

  /**
   * GET /api/players/:id/upgrades - Get player upgrades
   */
  router.get('/:id/upgrades', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const getUpgrades = container.get('getUpgrades');

    const result = await getUpgrades.execute({ playerId: id });
    res.json(result);
  }));

  /**
   * POST /api/players/:id/upgrades - Buy permanent upgrade
   */
  router.post('/:id/upgrades', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { upgradeName, cost, maxLevel } = req.body;
    const buyUpgrade = container.get('buyUpgrade');

    const upgrades = await buyUpgrade.execute({
      playerId: id,
      upgradeName,
      cost,
      maxLevel
    });

    res.json(upgrades.toObject());
  }));

  return router;
}

module.exports = initPlayerRoutes;
