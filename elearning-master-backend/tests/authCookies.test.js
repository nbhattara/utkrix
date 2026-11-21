const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');

describe('Authentication with Cookies', () => {
  let testUser;
  let agent;

  before(async () => {
    testUser = await prisma.user.create({
      data: {
        name: 'Cookie Test User',
        email: 'cookie-test@example.com',
        password: await bcrypt.hash('testpassword123456', 10),
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

  it('should login and set refresh token cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cookie-test@example.com',
        password: 'testpassword123456',
      })
      .expect(200);

    assert.ok(response.body.success);
    assert.ok(response.body.accessToken);
    assert.ok(response.body.user);
    assert.strictEqual(response.body.user.email, 'cookie-test@example.com');

    const cookies = response.headers['set-cookie'];
    assert.ok(cookies);
    assert.ok(cookies.some(cookie => cookie.includes('refreshToken')));
  });

  it('should refresh access token using cookie', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cookie-test@example.com',
        password: 'testpassword123456',
      });

    const cookies = loginResponse.headers['set-cookie'];

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);

    assert.ok(refreshResponse.body.success);
    assert.ok(refreshResponse.body.accessToken);
    assert.ok(refreshResponse.body.user);
  });

  it('should fail refresh without cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .expect(401);

    assert.ok(!response.body.success);
  });

  it('should logout and clear cookie', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cookie-test@example.com',
        password: 'testpassword123456',
      });

    const cookies = loginResponse.headers['set-cookie'];

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .expect(200);

    assert.ok(logoutResponse.body.success);

    const clearCookieHeader = logoutResponse.headers['set-cookie'];
    assert.ok(clearCookieHeader);
    assert.ok(clearCookieHeader.some(cookie => cookie.includes('refreshToken') && (cookie.includes('Max-Age=0') || cookie.includes('Expires=Thu, 01 Jan 1970'))));
  });

  it('should get current user with valid access token', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cookie-test@example.com',
        password: 'testpassword123456',
      });

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    assert.ok(meResponse.body.success);
    assert.ok(meResponse.body.user);
    assert.strictEqual(meResponse.body.user.email, 'cookie-test@example.com');
  });

  it('should fail to get current user without token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .expect(401);

    assert.ok(!response.body.success);
  });

  it('should fail login with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cookie-test@example.com',
        password: 'wrongpassword',
      })
      .expect(401);

    assert.ok(!response.body.success);
  });

  it('should fail login for unverified email', async () => {
    const unverifiedUser = await prisma.user.create({
      data: {
        name: 'Unverified User',
        email: 'unverified@example.com',
        password: await bcrypt.hash('testpassword123456', 10),
        role: 'student',
        emailVerified: false,
        isApproved: true,
        isActive: true,
      },
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'unverified@example.com',
        password: 'testpassword123456',
      })
      .expect(403);

    assert.ok(!response.body.success);
    assert.ok(response.body.message.includes('Verify your email'));

    await prisma.user.delete({ where: { id: unverifiedUser.id } });
  });
});
