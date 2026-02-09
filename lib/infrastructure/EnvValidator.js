/**
 * @fileoverview Environment variable validation at boot time
 * @description Uses Joi to validate all required environment variables
 * before the server starts. Fails fast with clear error messages.
 */

const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required()
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  DB_PATH: Joi.string().default('./data/game.db'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_DIR: Joi.string().default('./logs'),
  PERFORMANCE_MODE: Joi.string()
    .valid('high', 'balanced', 'low-memory', 'minimal')
    .default('balanced')
}).unknown(true);

/**
 * Validates process.env against the schema.
 * Exits with code 1 if validation fails.
 * @returns {Object} Validated and defaulted environment values
 */
function validateEnv() {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false
  });

  if (error) {
    const messages = error.details.map(d => `  - ${d.message}`).join('\n');
    console.error(`[FATAL] Environment validation failed:\n${messages}`);
    process.exit(1);
  }

  return value;
}

module.exports = { validateEnv };
