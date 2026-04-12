/**
 * @fileoverview Authentication routes
 * @description Handles JWT authentication for players
 * - POST /api/auth/login - Creates a new anonymous session with unique UUID
 * - Username is display-only; each login creates a fresh identity
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize auth routes
 * @param {Object} container - Dependency injection container
 * @param {Object} jwtService - JWT service instance
 * @returns {Router} Express router
 */
function initAuthRoutes(container, jwtService) {
  /**
   * POST /api/auth/login
   * Always creates a new anonymous identity — username is display-only.
   * Never reuses an existing account by username to prevent account takeover.
   */
  router.post('/login', async (req, res) => {
    try {
      const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';

      if (!rawUsername || rawUsername.length < 2 || rawUsername.length > 15) {
        return res.status(400).json({ error: 'Invalid username (2-15 characters required)' });
      }

      if (!/^[a-zA-Z0-9 _-]+$/.test(rawUsername)) {
        return res.status(400).json({
          error: 'Username can only contain letters, numbers, spaces, underscore and dash'
        });
      }

      const playerId = crypto.randomUUID();

      const token = jwtService.generateToken({ userId: playerId, username: rawUsername });

      if (container && typeof container.get === 'function') {
        try {
          const createPlayerUseCase = container.get('createPlayerUseCase');
          await createPlayerUseCase.execute({ id: playerId, username: rawUsername });
        } catch (dbErr) {
          logger.warn('Failed to persist new player', { error: dbErr.message });
          // Non-blocking: game session proceeds without DB record
        }
      }

      logger.info('Player authenticated', { userId: playerId, username: rawUsername });

      return res.json({
        token,
        player: { id: playerId, username: rawUsername, highScore: 0, totalKills: 0, gamesPlayed: 0 }
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message });
      res.status(500).json({ error: 'Login failed' });
    }
  });

  return router;
}

module.exports = initAuthRoutes;
