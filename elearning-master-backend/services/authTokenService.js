const crypto = require('crypto');
const AppError = require('../utils/AppError');

const TOKEN_LIFETIMES = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
  oauth_exchange: 5 * 60 * 1000,
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createAuthToken = async (prisma, userId, purpose, persist = true) => {
  const lifetime = TOKEN_LIFETIMES[purpose];
  if (!lifetime) {
    throw new AppError('Invalid token purpose', 400);
  }

  const token = crypto.randomBytes(32).toString('hex');
  if (persist) {
    await prisma.$transaction(async (tx) => {
      await tx.authToken.deleteMany({ where: { userId, purpose } });
      await tx.authToken.create({
        data: {
          userId,
          purpose,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + lifetime),
        },
      });
    });
  }

  return token;
};

const consumeAuthToken = async (prisma, token, purpose, updateUser) => {
  if (typeof token !== 'string' || token.length !== 64) {
    throw new AppError('Invalid or expired token', 400);
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const authToken = await tx.authToken.findUnique({ where: { tokenHash } });
    if (!authToken || authToken.purpose !== purpose || authToken.expiresAt <= now) {
      throw new AppError('Invalid or expired token', 400);
    }

    const consumed = await tx.authToken.deleteMany({
      where: {
        id: authToken.id,
        userId: authToken.userId,
        purpose,
        tokenHash,
        expiresAt: { gt: now },
      },
    });
    if (consumed.count !== 1) {
      throw new AppError('Invalid or expired token', 400);
    }

    await updateUser(tx, authToken.userId);
  });
};

module.exports = { createAuthToken, consumeAuthToken, hashToken };
