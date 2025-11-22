/**
 * @fileoverview Utility functions for game logic
 * @description Provides utility functions for:
 * - Distance calculation
 * - Player bullet cleanup
 * - Upgrade choice generation
 * - XP calculation for level progression
 */

const ConfigManager = require('../lib/server/ConfigManager');
const { LEVEL_UP_UPGRADES } = ConfigManager;
const logger = require('../lib/infrastructure/Logger');

/**
 * Fonction utilitaire pour calculer la distance
 * @param {number} x1 - X coordinate of first point
 * @param {number} y1 - Y coordinate of first point
 * @param {number} x2 - X coordinate of second point
 * @param {number} y2 - Y coordinate of second point
 * @returns {number} Distance between the two points
 */
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * OPTIMISATION: Calculer la distance au carré (évite le sqrt coûteux)
 * Utilisez cette fonction quand vous comparez des distances (>, <, ===)
 * car distance1² < distance2² ⟺ distance1 < distance2
 * @param {number} x1 - X coordinate of first point
 * @param {number} y1 - Y coordinate of first point
 * @param {number} x2 - X coordinate of second point
 * @param {number} y2 - Y coordinate of second point
 * @returns {number} Squared distance between the two points
 */
function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * CORRECTION: Fonction partagée pour nettoyer les balles d'un joueur
 * @param {string} playerId - Player ID
 * @param {Object} gameState - Game state object
 * @param {Object} entityManager - Entity manager instance
 */
function cleanupPlayerBullets(playerId, gameState, entityManager) {
  for (let bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];
    if (bullet.playerId === playerId) {
      entityManager.destroyBullet(bulletId);
    }
  }
}

/**
 * Générer 3 choix d'upgrades aléatoires avec pondération par rareté
 * CORRECTION: Ajout d'une limite de tentatives pour éviter les boucles infinies
 * @returns {Array} Array of upgrade choices
 */
function generateUpgradeChoices() {
  const upgradeKeys = Object.keys(LEVEL_UP_UPGRADES);
  const choices = [];
  const selectedKeys = new Set();

  // CORRECTION: Limite de tentatives pour éviter boucle infinie si pas assez d'upgrades d'une rareté
  let attempts = 0;
  const MAX_ATTEMPTS = 100;

  // Pondération par rareté : common: 60%, rare: 30%, legendary: 10%
  while (choices.length < 3 && selectedKeys.size < upgradeKeys.length && attempts < MAX_ATTEMPTS) {
    attempts++;
    const rand = Math.random();
    let targetRarity;

    if (rand < 0.60) {
      targetRarity = 'common';
    } else if (rand < 0.90) {
      targetRarity = 'rare';
    } else {
      targetRarity = 'legendary';
    }

    // Trouver un upgrade de cette rareté qui n'a pas déjà été sélectionné
    const availableUpgrades = upgradeKeys.filter(key =>
      LEVEL_UP_UPGRADES[key].rarity === targetRarity && !selectedKeys.has(key)
    );

    if (availableUpgrades.length > 0) {
      const selectedKey = availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)];
      selectedKeys.add(selectedKey);
      choices.push({
        id: selectedKey,
        name: LEVEL_UP_UPGRADES[selectedKey].name,
        description: LEVEL_UP_UPGRADES[selectedKey].description,
        rarity: LEVEL_UP_UPGRADES[selectedKey].rarity
      });
    }
  }

  // Si on n'a pas réussi à avoir 3 choix avec la pondération, compléter avec n'importe quoi
  while (choices.length < 3 && selectedKeys.size < upgradeKeys.length) {
    const availableUpgrades = upgradeKeys.filter(key => !selectedKeys.has(key));
    if (availableUpgrades.length > 0) {
      const selectedKey = availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)];
      selectedKeys.add(selectedKey);
      choices.push({
        id: selectedKey,
        name: LEVEL_UP_UPGRADES[selectedKey].name,
        description: LEVEL_UP_UPGRADES[selectedKey].description,
        rarity: LEVEL_UP_UPGRADES[selectedKey].rarity
      });
    } else {
      break;
    }
  }

  // CORRECTION: Log warning si on n'a pas pu générer 3 choix
  if (choices.length < 3) {
    logger.warn('Could only generate limited upgrade choices', { generated: choices.length, requested: 3, totalAvailable: upgradeKeys.length });
  }

  return choices;
}

/**
 * Calculer l'XP nécessaire pour le niveau suivant (Courbe améliorée plus progressive)
 * @param {number} level - Current level
 * @returns {number} XP required for next level
 */
function getXPForLevel(level) {
  // Courbe plus douce : les premiers niveaux sont rapides, puis ralentit progressivement
  if (level <= 5) {
    return 50 + (level - 1) * 30; // Niveaux 1-5 : 50, 80, 110, 140, 170
  } else if (level <= 10) {
    return 200 + (level - 5) * 50; // Niveaux 6-10 : 200, 250, 300, 350, 400
  } else if (level <= 20) {
    return 400 + (level - 10) * 75; // Niveaux 11-20 : 475, 550, 625...
  } else {
    return Math.floor(1000 + (level - 20) * 100); // Niveaux 20+ : 1100, 1200, 1300...
  }
}

module.exports = {
  distance,
  distanceSquared,
  cleanupPlayerBullets,
  generateUpgradeChoices,
  getXPForLevel
};
