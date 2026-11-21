const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { prisma } = require('../config/prisma');
const {
  createRefreshToken,
  rotateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  hashToken,
  cleanupExpiredTokens,
} = require('../services/refreshTokenService');

describe('Refresh Token Service', () => {
  let testUser;

  before(async () => {
    testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'refresh-test@example.com',
        password: 'hashedpassword123',
        role: 'student',
        emailVerified: true,
        isApproved: true,
        isActive: true,
      },
    });
  });

  after(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  it('should create a refresh token', async () => {
    const token = await createRefreshToken(
      prisma,
      testUser.id,
      'TestAgent/1.0',
      '127.0.0.1'
    );

    assert.ok(token);
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 64);

    const tokenHash = hashToken(token);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    assert.ok(storedToken);
    assert.strictEqual(storedToken.userId, testUser.id);
    assert.strictEqual(storedToken.userAgent, 'TestAgent/1.0');
    assert.strictEqual(storedToken.ipAddress, '127.0.0.1');
  });

  it('should rotate a refresh token', async () => {
    const oldToken = await createRefreshToken(
      prisma,
      testUser.id,
      'TestAgent/1.0',
      '127.0.0.1'
    );

    const result = await rotateRefreshToken(
      prisma,
      hashToken(oldToken),
      'TestAgent/1.0',
      '127.0.0.1'
    );

    assert.ok(result.accessToken);
    assert.ok(result.refreshToken);
    assert.ok(result.user);
    assert.strictEqual(result.user.id, testUser.id);

    const oldTokenHash = hashToken(oldToken);
    const oldStoredToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: oldTokenHash },
    });

    assert.strictEqual(oldStoredToken, null);

    const newTokenHash = hashToken(result.refreshToken);
    const newStoredToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    assert.ok(newStoredToken);
    assert.strictEqual(newStoredToken.userId, testUser.id);
  });

  it('should verify a refresh token', async () => {
    const token = await createRefreshToken(
      prisma,
      testUser.id,
      'TestAgent/1.0',
      '127.0.0.1'
    );

    const verified = await verifyRefreshToken(prisma, token);

    assert.ok(verified);
    assert.strictEqual(verified.user.id, testUser.id);
    assert.strictEqual(verified.user.email, testUser.email);
  });

  it('should revoke a refresh token', async () => {
    const token = await createRefreshToken(
      prisma,
      testUser.id,
      'TestAgent/1.0',
      '127.0.0.1'
    );

    await revokeRefreshToken(prisma, hashToken(token));

    const tokenHash = hashToken(token);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    assert.strictEqual(storedToken, null);
  });

  it('should revoke all user tokens', async () => {
    await createRefreshToken(prisma, testUser.id, 'TestAgent/1.0', '127.0.0.1');
    await createRefreshToken(prisma, testUser.id, 'TestAgent/1.0', '127.0.0.1');
    await createRefreshToken(prisma, testUser.id, 'TestAgent/1.0', '127.0.0.1');

    await revokeAllUserTokens(prisma, testUser.id);

    const remainingTokens = await prisma.refreshToken.findMany({
      where: { userId: testUser.id },
    });

    assert.strictEqual(remainingTokens.length, 0);
  });

  it('should cleanup expired tokens', async () => {
    await prisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken('expiredtoken123'),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const deletedCount = await cleanupExpiredTokens(prisma);

    assert.ok(deletedCount >= 1);
  });
});
