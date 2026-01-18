/**
 * @fileoverview Authentication routes
 * @description Handles JWT authentication for players
 * - POST /api/auth/login - Login endpoint with JWT token generation
 * - Validates username format and length
 * - Creates or retrieves player from database
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize auth routes
 * @param {Object} container - Dependency injection container
 * @param {Object} jwtService - JWT service instance
 * @returns {Router} Express router
 */
function initAuthRoutes(container, jwtService) {
  /**
   * POST /api/auth/login - Authentification JWT
   */
  router.post('/login', async (req, res) => {
    try {
      const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';

      // Validation
      if (!rawUsername || rawUsername.length < 2 || rawUsername.length > 15) {
        return res.status(400).json({
          error: 'Invalid username (2-15 characters required)'
        });
      }

      if (!/^[a-zA-Z0-9 _-]+$/.test(rawUsername)) {
        return res.status(400).json({
          error: 'Username can only contain letters, numbers, spaces, underscore and dash'
        });
      }

      const playerId = require('crypto').randomUUID();

      if (!container || typeof container.get !== 'function') {
        const token = jwtService.generateToken({
          userId: playerId,
          username: rawUsername
        });

        logger.warn('Player authenticated without database', {
          userId: playerId,
          username: rawUsername
        });

        return res.json({
          token,
          player: {
            id: playerId,
            username: rawUsername,
            highScore: 0,
            totalKills: 0,
            gamesPlayed: 0
          }
        });
      }

      // Créer ou récupérer le joueur
      const playerRepository = container.get('playerRepository');
      let player = await playerRepository.findByUsername(rawUsername);

      if (!player) {
        // Créer un nouveau joueur
        const createPlayerUseCase = container.get('createPlayerUseCase');
        player = await createPlayerUseCase.execute({ id: playerId, username: rawUsername });
      }

      // Générer JWT
      const token = jwtService.generateToken({
        userId: player.id,
        username: player.username
      });

      logger.info('Player authenticated', {
        userId: player.id,
        username: player.username
      });

      res.json({
        token,
        player: {
          id: player.id,
          username: player.username,
          highScore: player.highScore || 0,
          totalKills: player.totalKills || 0,
          gamesPlayed: player.gamesPlayed || 0
        }
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message });
      res.status(500).json({ error: 'Login failed' });
    }
  });

  return router;
}

module.exports = initAuthRoutes;
