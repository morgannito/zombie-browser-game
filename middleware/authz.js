function requireSameUserInParam(paramName = 'id') {
  return (req, res, next) => {
    const requestedUserId = req.params[paramName];

    if (!requestedUserId || req.userId !== requestedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: token user does not match requested player'
      });
    }

    next();
  };
}

function requireSameUserInBody(fieldName = 'playerId') {
  return (req, res, next) => {
    const requestedUserId = req.body[fieldName];

    if (!requestedUserId) {
      return res.status(400).json({
        success: false,
        error: `Missing required field: ${fieldName}`
      });
    }

    if (req.userId !== requestedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: token user does not match requested player'
      });
    }

    next();
  };
}

function requireSameUserInQuery(fieldName = 'playerId') {
  return (req, res, next) => {
    const requestedUserId = req.query[fieldName];
    if (!requestedUserId) {
      return next();
    }

    if (req.userId !== requestedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: token user does not match requested player'
      });
    }

    next();
  };
}

module.exports = {
  requireSameUserInParam,
  requireSameUserInBody,
  requireSameUserInQuery
};
