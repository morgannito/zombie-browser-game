const Joi = require('joi');

function validateRequest(schemas = {}) {
  return (req, res, next) => {
    const targets = ['params', 'query', 'body'];

    for (const target of targets) {
      const schema = schemas[target];
      if (!schema) {
        continue;
      }

      const { value, error } = schema.validate(req[target], {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.details.map(detail => detail.message)
        });
      }

      req[target] = value;
    }

    next();
  };
}

module.exports = {
  Joi,
  validateRequest
};
