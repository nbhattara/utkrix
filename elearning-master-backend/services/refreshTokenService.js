const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const REFRESH_TOKEN_LIFETIME = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACCESS_TOKEN_LIFETIME = 15 * 60 * 1000; // 15 minutes

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');

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

const issueRefreshToken = (user) => jwt.sign(
  {
    id: user.id,
    tokenVersion: user.tokenVersion,
  },
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

const createRefreshToken = async (prisma, userId, userAgent, ipAddress) => {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      userAgent: userAgent?.substring(0, 500),
      ipAddress: ipAddress?.substring(0, 45),
      expiresAt,
    },
  });

  return token;
};

const rotateRefreshToken = async (prisma, oldTokenHash, userAgent, ipAddress) => {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const oldToken = await tx.refreshToken.findUnique({
      where: { tokenHash: oldTokenHash },
    });

    if (!oldToken || oldToken.expiresAt <= now) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await tx.user.findUnique({
      where: { id: oldToken.userId },
      select: { id: true, email: true, role: true, tier: true, tokenVersion: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    const newToken = generateRefreshToken();
    const newTokenHash = hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME);

    const createdToken = await tx.refreshToken.create({
      data: {
        userId: oldToken.userId,
        tokenHash: newTokenHash,
        userAgent: userAgent?.substring(0, 500),
        ipAddress: ipAddress?.substring(0, 45),
        expiresAt: newExpiresAt,
        replacedBy: oldToken.id,
      },
    });

    await tx.refreshToken.delete({
      where: { id: oldToken.id },
    });

    const accessToken = issueAccessToken(user);

    return {
      accessToken,
      refreshToken: newToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tier: user.tier,
      },
    };
  });
};

const verifyRefreshToken = async (prisma, token) => {
  const tokenHash = hashToken(token);
  const now = new Date();

  const refreshToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          tier: true,
          tokenVersion: true,
          isActive: true,
          emailVerified: true,
          isApproved: true,
        },
      },
    },
  });

  if (!refreshToken || refreshToken.expiresAt <= now) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (!refreshToken.user || !refreshToken.user.isActive) {
    throw new AppError('User not found or inactive', 401);
  }

  if (!refreshToken.user.emailVerified) {
    throw new AppError('Email not verified', 403);
  }

  if (refreshToken.user.role === 'instructor' && !refreshToken.user.isApproved) {
    throw new AppError('Instructor account not approved', 403);
  }

  return refreshToken;
};

const revokeRefreshToken = async (prisma, tokenHash) => {
  await prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });
};

const revokeAllUserTokens = async (prisma, userId) => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

const cleanupExpiredTokens = async (prisma) => {
  const now = new Date();
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });
  return result.count;
};

module.exports = {
  hashToken,
  generateRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  createRefreshToken,
  rotateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  REFRESH_TOKEN_LIFETIME,
  ACCESS_TOKEN_LIFETIME,
};
