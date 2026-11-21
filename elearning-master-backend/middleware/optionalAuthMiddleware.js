const protect = require('./authMiddleware');

const optionalProtect = (req, res, next) => {
  if (!req.headers.authorization) {
    return next();
  }
  return protect(req, res, next);
};

module.exports = optionalProtect;
