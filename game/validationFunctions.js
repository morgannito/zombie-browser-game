/**
 * @fileoverview Input validation utilities with Joi
 * @description Provides validation functions for socket events
 * - Number validation with range checking
 * - String validation with length limits
 * - Movement data validation
 * - Shoot data validation
 * - Upgrade data validation
 * - Buy item data validation
 */

const Joi = require('joi');
const ConfigManager = require('../lib/server/ConfigManager');
const { CONFIG, LEVEL_UP_UPGRADES, SHOP_ITEMS } = ConfigManager;
const logger = require('../lib/infrastructure/Logger');

// Joi validation schemas
const movementSchema = Joi.object({
  x: Joi.number().min(0).max(CONFIG.ROOM_WIDTH).required(),
  y: Joi.number().min(0).max(CONFIG.ROOM_HEIGHT).required(),
  angle: Joi.number().min(-Math.PI * 2).max(Math.PI * 2).required()
}).unknown(false);

const shootSchema = Joi.object({
  angle: Joi.number().min(-Math.PI * 2).max(Math.PI * 2).required()
}).unknown(false);

const upgradeSchema = Joi.object({
  upgradeId: Joi.string().max(100).required()
}).unknown(false);

const buyItemSchema = Joi.object({
  itemId: Joi.string().max(100).required(),
  category: Joi.string().valid('permanent', 'temporary').required()
}).unknown(false);

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
  const { error, value } = movementSchema.validate(data);

  if (error) {
    logger.debug('Movement validation failed', { error: error.message, data });
    return null;
  }

  return value;
}

/**
 * Valide les données d'un tir
 * @param {*} data - Données du tir
 * @returns {Object|null}
 */
function validateShootData(data) {
  const { error, value } = shootSchema.validate(data);

  if (error) {
    logger.debug('Shoot validation failed', { error: error.message, data });
    return null;
  }

  return value;
}

/**
 * Valide les données de sélection d'upgrade
 * @param {*} data - Données de l'upgrade
 * @returns {Object|null}
 */
function validateUpgradeData(data) {
  const { error, value } = upgradeSchema.validate(data);

  if (error) {
    logger.debug('Upgrade validation failed', { error: error.message, data });
    return null;
  }

  // Vérifier que l'upgrade existe dans la configuration
  if (!LEVEL_UP_UPGRADES[value.upgradeId]) {
    logger.debug('Unknown upgrade ID', { upgradeId: value.upgradeId });
    return null;
  }

  return value;
}

/**
 * Valide les données d'achat d'item
 * @param {*} data - Données de l'achat
 * @returns {Object|null}
 */
function validateBuyItemData(data) {
  const { error, value } = buyItemSchema.validate(data);

  if (error) {
    logger.debug('Buy item validation failed', { error: error.message, data });
    return null;
  }

  // Vérifier que l'item existe dans la configuration
  if (!SHOP_ITEMS[value.category] || !SHOP_ITEMS[value.category][value.itemId]) {
    logger.debug('Unknown shop item', { itemId: value.itemId, category: value.category });
    return null;
  }

  return value;
}

module.exports = {
  isValidNumber,
  isValidString,
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
};
