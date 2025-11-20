/**
 * @fileoverview Particle effect presets
 * @description Predefined particle effects to reduce code duplication
 */

const { createParticles } = require('./lootFunctions');

/**
 * Particle effect presets
 */
const ParticleEffects = {
  /**
   * Blood splatter effect (zombie death)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} color - Blood color
   * @param {Object} entityManager - Entity manager instance
   */
  blood: (x, y, color, entityManager) => {
    createParticles(x, y, color, 8, entityManager);
  },

  /**
   * Small blood splatter (zombie hit)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} color - Blood color
   * @param {Object} entityManager - Entity manager instance
   */
  bloodSmall: (x, y, color, entityManager) => {
    createParticles(x, y, color, 5, entityManager);
  },

  /**
   * Explosion effect (large)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  explosion: (x, y, entityManager) => {
    createParticles(x, y, '#ff8800', 20, entityManager);
  },

  /**
   * Explosion effect (medium)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  explosionMedium: (x, y, entityManager) => {
    createParticles(x, y, '#ff8800', 12, entityManager);
  },

  /**
   * Explosion effect (small)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  explosionSmall: (x, y, entityManager) => {
    createParticles(x, y, '#ff8800', 6, entityManager);
  },

  /**
   * Fire effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  fire: (x, y, entityManager) => {
    createParticles(x, y, '#ff4400', 10, entityManager);
  },

  /**
   * Poison effect (green)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  poison: (x, y, entityManager) => {
    createParticles(x, y, '#00ff00', 8, entityManager);
  },

  /**
   * Ice effect (blue)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  ice: (x, y, entityManager) => {
    createParticles(x, y, '#00ffff', 8, entityManager);
  },

  /**
   * Lightning effect (yellow)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  lightning: (x, y, entityManager) => {
    createParticles(x, y, '#ffff00', 12, entityManager);
  },

  /**
   * Gold coin effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  goldCoin: (x, y, entityManager) => {
    createParticles(x, y, '#ffd700', 6, entityManager);
  },

  /**
   * Player death effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} entityManager - Entity manager instance
   */
  playerDeath: (x, y, entityManager) => {
    createParticles(x, y, '#ff0000', 15, entityManager);
  }
};

/**
 * Create custom particle effect
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} color - Particle color
 * @param {number} count - Number of particles
 * @param {Object} entityManager - Entity manager instance
 */
function createCustomEffect(x, y, color, count, entityManager) {
  createParticles(x, y, color, count, entityManager);
}

module.exports = {
  ParticleEffects,
  createCustomEffect
};
