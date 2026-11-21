const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { validateCSRF, CSRF_TOKEN_COOKIE_NAME, CSRF_HEADER_NAME } = require('../middleware/csrfMiddleware');

const TEST_EMAIL = 'security-test@example.com';
const TEST_PASSWORD = 'testpassword123456';
const ALLOWED_ORIGIN = 'http://localhost:5173';
const DISALLOWED_ORIGIN = 'http://evil.example.com';

describe('CORS configuration', () => {
  it('accepts requests from an allowed origin with credentials', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    assert.strictEqual(response.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    assert.strictEqual(response.headers['access-control-allow-credentials'], 'true');
  });

  it('rejects requests from an unauthorized origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', DISALLOWED_ORIGIN);

    assert.strictEqual(response.status, 403);
    assert.ok(!response.headers['access-control-allow-origin']);
  });

  it('handles credentialed preflight OPTIONS requests', async () => {
    const response = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token')
      .expect(204);

    assert.strictEqual(response.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    assert.strictEqual(response.headers['access-control-allow-credentials'], 'true');
    assert.ok(response.headers['access-control-allow-methods'].includes('POST'));
    assert.ok(response.headers['access-control-allow-headers'].toLowerCase().includes('x-csrf-token'));
  });
});

describe('CSRF validation middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  after(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const runValidate = (req) => new Promise((resolve) => {
    const res = {};
    validateCSRF(req, res, (error) => resolve(error || null));
  });

  it('rejects state-changing requests without tokens in production', async () => {
    process.env.NODE_ENV = 'production';
    const error = await runValidate({ cookies: {}, headers: {} });
    assert.ok(error);
    assert.strictEqual(error.statusCode, 403);
  });

  it('rejects mismatched CSRF tokens in production', async () => {
    process.env.NODE_ENV = 'production';
    const error = await runValidate({
      cookies: { [CSRF_TOKEN_COOKIE_NAME]: 'token-a' },
      headers: { [CSRF_HEADER_NAME]: 'token-b' },
    });
    assert.ok(error);
    assert.strictEqual(error.statusCode, 403);
  });

  it('accepts matching CSRF tokens in production', async () => {
    process.env.NODE_ENV = 'production';
    const error = await runValidate({
      cookies: { [CSRF_TOKEN_COOKIE_NAME]: 'token-a' },
      headers: { [CSRF_HEADER_NAME]: 'token-a' },
    });
    assert.strictEqual(error, null);
  });
});

describe('Auth flow security', () => {
  let testUser;

  before(async () => {
    testUser = await prisma.user.create({
      data: {
        name: 'Security Test User',
        email: TEST_EMAIL,
        password: await bcrypt.hash(TEST_PASSWORD, 10),
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

  it('rejects registration with missing required fields', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: TEST_EMAIL })
      .expect(400);

    assert.ok(!response.body.success);
  });

  it('rejects registration with a duplicate email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Duplicate User',
        email: TEST_EMAIL,
        password: 'anotherlongpassword1',
      })
      .expect(400);

    assert.ok(!response.body.success);
    assert.ok(response.body.message.toLowerCase().includes('already exists'));
  });

  it('rejects login with a missing password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL })
      .expect(400);

    assert.ok(!response.body.success);
  });

  it('rejects an expired access token', async () => {
    const expiredToken = jwt.sign(
      {
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        tier: testUser.tier,
        tokenVersion: testUser.tokenVersion,
      },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    assert.ok(!response.body.success);
  });

  it('rotates refresh tokens and rejects reuse of the old token', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'];

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);

    assert.ok(refreshResponse.body.accessToken);

    const reuseResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(401);

    assert.ok(!reuseResponse.body.success);
  });

  it('scopes auth cookies to the configured domain for subdomain sharing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    const cookies = response.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((cookie) => cookie.includes('refreshToken'));
    assert.ok(refreshCookie);
    assert.ok(refreshCookie.includes('HttpOnly'));
    const expectedDomain = process.env.COOKIE_DOMAIN;
    if (expectedDomain) {
      assert.ok(refreshCookie.includes(`Domain=${expectedDomain}`));
    }
  });
});
