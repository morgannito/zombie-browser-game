/**
 * @fileoverview Input validation utilities
 * @description Provides validation functions for socket events
 * - Number validation with range checking
 * - String validation with length limits
 * - Movement data validation
 * - Shoot data validation
 * - Upgrade data validation
 * - Buy item data validation
 */

const ConfigManager = require('../lib/server/ConfigManager');
const { CONFIG, LEVEL_UP_UPGRADES, SHOP_ITEMS } = ConfigManager;

/**
 * Valide que la valeur est un nombre fini et valide
 * @param {*} value - Valeur à valider
 * @param {number} min - Valeur minimale (optionnel)
 * @param {number} max - Valeur maximale (optionnel)
 * @returns {boolean}
 */
function isValidNumber(value, min = -Infinity, max = Infinity) {
  return typeof value === 'number' && isFinite(value) && value >= min && value <= max;
}

/**
 * Valide que la valeur est une chaîne non vide et sécurisée
 * @param {*} value - Valeur à valider
 * @param {number} maxLength - Longueur maximale
 * @returns {boolean}
 */
function isValidString(value, maxLength = 1000) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

/**
 * Valide et sanitize un objet de données de mouvement
 * @param {*} data - Données du mouvement
 * @returns {Object|null} Données validées ou null si invalides
 */
function validateMovementData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Valider x, y, angle comme nombres valides
  if (!isValidNumber(data.x, 0, CONFIG.ROOM_WIDTH) ||
      !isValidNumber(data.y, 0, CONFIG.ROOM_HEIGHT) ||
      !isValidNumber(data.angle, -Math.PI * 2, Math.PI * 2)) {
    return null;
  }

  return {
    x: data.x,
    y: data.y,
    angle: data.angle
  };
}

/**
 * Valide les données d'un tir
 * @param {*} data - Données du tir
 * @returns {Object|null}
 */
function validateShootData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (!isValidNumber(data.angle, -Math.PI * 2, Math.PI * 2)) {
    return null;
  }

  return { angle: data.angle };
}

/**
 * Valide les données de sélection d'upgrade
 * @param {*} data - Données de l'upgrade
 * @returns {Object|null}
 */
function validateUpgradeData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (!isValidString(data.upgradeId, 100)) {
    return null;
  }

  // Vérifier que l'upgrade existe dans la configuration
  if (!LEVEL_UP_UPGRADES[data.upgradeId]) {
    return null;
  }

  return { upgradeId: data.upgradeId };
}

/**
 * Valide les données d'achat d'item
 * @param {*} data - Données de l'achat
 * @returns {Object|null}
 */
function validateBuyItemData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (!isValidString(data.itemId, 100) || !isValidString(data.category, 50)) {
    return null;
  }

  // Vérifier que la catégorie est valide
  if (data.category !== 'permanent' && data.category !== 'temporary') {
    return null;
  }

  // Vérifier que l'item existe dans la configuration
  if (!SHOP_ITEMS[data.category] || !SHOP_ITEMS[data.category][data.itemId]) {
    return null;
  }

  return {
    itemId: data.itemId,
    category: data.category
  };
}

module.exports = {
  isValidNumber,
  isValidString,
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
};
