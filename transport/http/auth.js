/**
 * @fileoverview Authentication routes
 * @description Handles JWT authentication for players
 * - POST /api/auth/login - Creates a new anonymous session with unique UUID
 * - Username is display-only; each login creates a fresh identity
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../../infrastructure/logging/Logger');
const { configureAuthLimiter } = require('../../middleware/security');

const authLimiter = configureAuthLimiter();

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
  router.post('/login', authLimiter, async (req, res) => {
    try {
      const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';

      if (!rawUsername || rawUsername.length < 2 || rawUsername.length > 15) {
        return res.status(400).json({ error: 'USERNAME_INVALID', message: 'Le pseudo doit contenir entre 2 et 15 caractères.' });
      }

      if (!/^[a-zA-Z0-9 _-]+$/.test(rawUsername)) {
        return res.status(400).json({
          error: 'USERNAME_CHARS_INVALID', message: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces, tirets et underscores.'
        });
      }

      const playerId = crypto.randomUUID();

      const token = jwtService.generateToken({ userId: playerId, username: rawUsername });

      if (container && typeof container.get === 'function') {
        try {
          const createPlayerUseCase = container.get('createPlayerUseCase');
          await createPlayerUseCase.execute({ id: playerId, username: rawUsername });
        } catch (dbErr) {
          logger.warn('Failed to persist new player', { requestId: req.id, error: dbErr.message });
        }
      }

      logger.info('Player authenticated', { requestId: req.id, userId: playerId });

      return res.json({
        token,
        player: { id: playerId, username: rawUsername, highScore: 0, totalKills: 0, gamesPlayed: 0 }
      });
    } catch (error) {
      logger.error('Login failed', { requestId: req.id, error: error.message });
      res.status(500).json({ error: 'LOGIN_FAILED', message: 'Impossible de créer la session. Réessaie dans un moment.' });
    }
  });

  return router;
}

module.exports = initAuthRoutes;
