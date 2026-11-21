const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { loginLimiter, registrationLimiter } = require('../middleware/rateLimitMiddleware');

test('registration attempts do not consume the login rate limit', async () => {
  const app = express();
  app.post('/register', registrationLimiter, (_req, res) => res.sendStatus(201));
  app.post('/login', loginLimiter, (_req, res) => res.sendStatus(401));

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const { port } = server.address();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/register`, { method: 'POST' });
      assert.equal(response.status, 201);
    }

    const excessRegistration = await fetch(`http://127.0.0.1:${port}/register`, { method: 'POST' });
    assert.equal(excessRegistration.status, 429);

    const loginResponse = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
    assert.equal(loginResponse.status, 401);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
