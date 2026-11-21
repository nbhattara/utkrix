const test = require('node:test');
const assert = require('node:assert/strict');
const oauthController = require('../controllers/oauthController');

const originalEnv = Object.fromEntries([
  'FRONTEND_URL',
  'OAUTH_CALLBACK_BASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'FACEBOOK_GRAPH_VERSION',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
].map((key) => [key, process.env[key]]));

const setOAuthEnv = () => {
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.OAUTH_CALLBACK_BASE_URL = 'http://localhost:5000/api/v1/auth/oauth';
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  process.env.FACEBOOK_APP_ID = 'facebook-app-id';
  process.env.FACEBOOK_APP_SECRET = 'facebook-app-secret';
  process.env.FACEBOOK_GRAPH_VERSION = 'v24.0';
  process.env.GITHUB_CLIENT_ID = 'github-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
};

const createResponse = () => ({
  headers: [],
  statusCode: null,
  location: null,
  append(name, value) {
    if (name === 'Set-Cookie') this.headers.push(value);
  },
  redirect(statusCode, location) {
    this.statusCode = statusCode;
    this.location = location;
    return this;
  },
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('OAuth start redirects to Google with state and PKCE without exposing the secret', (t) => {
  setOAuthEnv();
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const response = createResponse();
  oauthController.start({ params: { provider: 'google' } }, response);

  assert.equal(response.statusCode, 302);
  const redirect = new URL(response.location);
  assert.equal(redirect.origin, 'https://accounts.google.com');
  assert.equal(redirect.searchParams.get('client_id'), 'google-client-id');
  assert.equal(redirect.searchParams.get('redirect_uri'), 'http://localhost:5000/api/v1/auth/oauth/google/callback');
  assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
  assert.match(redirect.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(redirect.searchParams.get('state').length, 64);
  assert.equal(response.location.includes('google-client-secret'), false);
  assert.ok(response.headers.some((cookie) => cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')));
});

test('OAuth start omits PKCE for Facebook and rejects unsupported providers', (t) => {
  setOAuthEnv();
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const facebookResponse = createResponse();
  oauthController.start({ params: { provider: 'facebook' } }, facebookResponse);
  const redirect = new URL(facebookResponse.location);
  assert.equal(redirect.searchParams.get('scope'), 'email,public_profile');
  assert.equal(redirect.searchParams.has('code_challenge'), false);

  const unsupportedResponse = createResponse();
  oauthController.start({ params: { provider: 'linkedin' } }, unsupportedResponse);
  assert.equal(unsupportedResponse.statusCode, 404);
  assert.equal(unsupportedResponse.payload.success, false);
});

test('OAuth start enables PKCE for GitHub', (t) => {
  setOAuthEnv();
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const response = createResponse();
  oauthController.start({ params: { provider: 'github' } }, response);
  const redirect = new URL(response.location);
  assert.equal(redirect.origin, 'https://github.com');
  assert.equal(redirect.searchParams.get('scope'), 'read:user user:email');
  assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
  assert.match(redirect.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
});

test('OAuth callback rejects a mismatched browser state and clears temporary cookies', async (t) => {
  setOAuthEnv();
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const response = createResponse();
  await oauthController.callback({
    params: { provider: 'google' },
    query: { state: 'attacker-state', code: 'authorization-code' },
    headers: { cookie: 'oauth_google_state=expected-state; oauth_google_verifier=temporary-verifier' },
  }, response);

  assert.equal(response.statusCode, 303);
  assert.match(response.location, /#\/login\?oauthError=invalid_state/);
  assert.equal(response.headers.filter((cookie) => cookie.includes('Max-Age=0')).length, 2);
});
