/**
 * VALIDATION SCHEMAS - Joi
 * Sécurise tous les inputs Socket.IO et REST API
 */

const Joi = require('joi');

// ============================================
// SOCKET.IO EVENT SCHEMAS
// ============================================

const playerReadySchema = Joi.object({
  nickname: Joi.string()
    .min(2)
    .max(20)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Nickname must contain only letters, numbers, underscore and dash',
      'string.min': 'Nickname must be at least 2 characters',
      'string.max': 'Nickname must be at most 20 characters'
    }),
  playerId: Joi.string()
    .guid({ version: 'uuidv4' })
    .required()
});

const playerActionSchema = Joi.object({
  movement: Joi.object({
    up: Joi.boolean(),
    down: Joi.boolean(),
    left: Joi.boolean(),
    right: Joi.boolean()
  }).required(),
  shooting: Joi.boolean().required(),
  mouseAngle: Joi.number()
    .min(0)
    .max(Math.PI * 2)
    .allow(null)
}).unknown(true); // Allow extra fields for backward compatibility

const playerMovementSchema = Joi.object({
  x: Joi.number()
    .min(-10000)
    .max(10000)
    .required(),
  y: Joi.number()
    .min(-10000)
    .max(10000)
    .required(),
  velocityX: Joi.number()
    .min(-1000)
    .max(1000),
  velocityY: Joi.number()
    .min(-1000)
    .max(1000)
});

const playerShootingSchema = Joi.object({
  angle: Joi.number()
    .min(0)
    .max(Math.PI * 2)
    .required(),
  x: Joi.number().required(),
  y: Joi.number().required()
});

const reconnectSchema = Joi.object({
  sessionId: Joi.string()
    .guid({ version: 'uuidv4' })
    .required(),
  playerId: Joi.string()
    .guid({ version: 'uuidv4' })
    .required()
});

const upgradeSchema = Joi.object({
  upgradeType: Joi.string()
    .valid('health', 'speed', 'fireRate', 'damage')
    .required(),
  playerId: Joi.string()
    .guid({ version: 'uuidv4' })
    .required()
});

// ============================================
// REST API SCHEMAS
// ============================================

const createPlayerSchema = Joi.object({
  username: Joi.string()
    .min(2)
    .max(20)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
});

const submitScoreSchema = Joi.object({
  playerId: Joi.string()
    .guid({ version: 'uuidv4' })
    .required(),
  wave: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required(),
  level: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required(),
  kills: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .required(),
  survivalTime: Joi.number()
    .integer()
    .min(0)
    .max(86400000) // Max 24h
    .required(),
  score: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .required()
});

const leaderboardQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
});

const buyUpgradeSchema = Joi.object({
  upgradeType: Joi.string()
    .valid('health', 'speed', 'fireRate', 'damage')
    .required(),
  level: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
});

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Valide des données contre un schéma Joi
 * @param {Joi.Schema} schema
 * @param {any} data
 * @returns {{ error: Joi.ValidationError | null, value: any }}
 */
function validate(schema, data) {
  return schema.validate(data, {
    abortEarly: false, // Return all errors
    stripUnknown: true // Remove unknown fields
  });
}

/**
 * Middleware Express pour validation
 * @param {Joi.Schema} schema
 * @returns {Function}
 */
function validateMiddleware(schema) {
  return (req, res, next) => {
    const { error, value } = validate(schema, req.body);

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.validatedData = value;
    next();
  };
}

module.exports = {
  // Socket.IO schemas
  playerReadySchema,
  playerActionSchema,
  playerMovementSchema,
  playerShootingSchema,
  reconnectSchema,
  upgradeSchema,

  // REST API schemas
  createPlayerSchema,
  submitScoreSchema,
  leaderboardQuerySchema,
  buyUpgradeSchema,

  // Helpers
  validate,
  validateMiddleware
};
