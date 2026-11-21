const jwt = require('jsonwebtoken');

const issueAccessToken = (user) => jwt.sign(
  {
    id: user.id,
    email: user.email,
    role: user.role,
    tier: user.tier,
    tokenVersion: user.tokenVersion,
  },
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

module.exports = { issueAccessToken };
