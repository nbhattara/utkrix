const test = require('node:test');
const assert = require('node:assert/strict');

const {
  consumeAuthToken,
  createAuthToken,
  hashToken,
} = require('../services/authTokenService');

const createPrismaMock = () => {
  const state = { tokens: new Map() };
  const tx = {
    authToken: {
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [hash, token] of state.tokens) {
          if ((!where.userId || token.userId === where.userId)
            && (!where.purpose || token.purpose === where.purpose)
            && (!where.id || token.id === where.id)
            && (!where.tokenHash || hash === where.tokenHash)) {
            state.tokens.delete(hash);
            count += 1;
          }
        }
        return { count };
      },
      create: async ({ data }) => {
        const token = { id: 1, userId: data.userId, ...data };
        state.tokens.set(data.tokenHash, token);
        return token;
      },
      findUnique: async ({ where }) => state.tokens.get(where.tokenHash) || null,
    },
  };

  return {
    state,
    $transaction: async (callback) => callback(tx),
  };
};

test('auth tokens are random and only their SHA-256 hashes are persisted', async () => {
  const prisma = createPrismaMock();
  const token = await createAuthToken(prisma, 17, 'email_verification');
  const [persistedHash, record] = [...prisma.state.tokens.entries()][0];

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(persistedHash, hashToken(token));
  assert.notEqual(record.tokenHash, token);
  assert.equal(record.userId, 17);
  assert.equal(record.purpose, 'email_verification');
});

test('OAuth exchange codes are hashed and expire after five minutes', async () => {
  const prisma = createPrismaMock();
  const token = await createAuthToken(prisma, 19, 'oauth_exchange');
  const [persistedHash, record] = [...prisma.state.tokens.entries()][0];
  const remainingLifetime = record.expiresAt.getTime() - Date.now();

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(persistedHash, hashToken(token));
  assert.equal(record.purpose, 'oauth_exchange');
  assert.ok(remainingLifetime > 0);
  assert.ok(remainingLifetime <= 5 * 60 * 1000);
});

test('consuming a valid token calls the update once and deletes the token', async () => {
  const prisma = createPrismaMock();
  const token = await createAuthToken(prisma, 18, 'password_reset');
  let updatedUserId;

  await consumeAuthToken(prisma, token, 'password_reset', async (_tx, userId) => {
    updatedUserId = userId;
  });

  assert.equal(updatedUserId, 18);
  assert.equal(prisma.state.tokens.size, 0);
});

test('consumed, unknown, and wrong-purpose tokens are rejected', async () => {
  const prisma = createPrismaMock();
  const token = await createAuthToken(prisma, 19, 'email_verification');

  await assert.rejects(
    consumeAuthToken(prisma, token, 'password_reset', async () => {}),
    { statusCode: 400 }
  );
  await consumeAuthToken(prisma, token, 'email_verification', async () => {});
  await assert.rejects(
    consumeAuthToken(prisma, token, 'email_verification', async () => {}),
    { statusCode: 400 }
  );
  await assert.rejects(
    consumeAuthToken(prisma, 'a'.repeat(64), 'email_verification', async () => {}),
    { statusCode: 400 }
  );
});
