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
const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize player routes
 * @param {Object} container - Dependency injection container
 * @returns {Router} Express router
 */
function initPlayerRoutes(container) {
  /**
   * GET /api/players/:id - Get player stats
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const playerRepo = container.getRepository('player');

      const player = await playerRepo.findById(id);
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const stats = await playerRepo.getStats(id);
      res.json({ player: player.toObject(), stats });
    } catch (error) {
      logger.error('Get player API error', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/players - Create player
   */
  router.post('/', async (req, res) => {
    try {
      const { id, username } = req.body;
      const createPlayer = container.get('createPlayer');

      const player = await createPlayer.execute({ id, username });
      res.status(201).json(player.toObject());
    } catch (error) {
      logger.error('Create player API error', { error: error.message });
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/players/:id/upgrades - Get player upgrades
   */
  router.get('/:id/upgrades', async (req, res) => {
    try {
      const { id } = req.params;
      const getUpgrades = container.get('getUpgrades');

      const result = await getUpgrades.execute({ playerId: id });
      res.json(result);
    } catch (error) {
      logger.error('Get upgrades API error', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/players/:id/upgrades - Buy permanent upgrade
   */
  router.post('/:id/upgrades', async (req, res) => {
    try {
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
    } catch (error) {
      logger.error('Buy upgrade API error', { error: error.message });
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = initPlayerRoutes;
