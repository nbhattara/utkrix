const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { prisma } = require('../config/prisma');
const { createAuthToken, consumeAuthToken } = require('../services/authTokenService');
const { issueAccessToken } = require('../services/authService');
const { assertEmailConfigured, sendEmailVerification } = require('../services/emailService');
const { createRefreshToken } = require('../services/refreshTokenService');
const { generateCSRFToken } = require('../middleware/csrfMiddleware');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const providers = ['google', 'facebook', 'github'];
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  tier: true,
  emailVerified: true,
  isApproved: true,
  isActive: true,
  tokenVersion: true,
};

const oauthError = (code, message, statusCode = 400) => {
  const error = new AppError(message, statusCode);
  error.oauthCode = code;
  return error;
};

const cookiePath = (provider) => `/api/v1/auth/oauth/${provider}`;
const cookieName = (provider, suffix) => `oauth_${provider}_${suffix}`;

const getCookie = (req, name) => {
  const cookies = (req.headers.cookie || '').split(';');
  const cookie = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : null;
};

const setOAuthCookie = (res, provider, suffix, value, maxAge) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${cookieName(provider, suffix)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=${cookiePath(provider)}${secure}`
  );
};

const clearOAuthCookies = (res, provider) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  for (const suffix of ['state', 'verifier']) {
    res.append(
      'Set-Cookie',
      `${cookieName(provider, suffix)}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=${cookiePath(provider)}${secure}`
    );
  }
};

const getCallbackUrl = (provider) => {
  const baseUrl = process.env.OAUTH_CALLBACK_BASE_URL;
  if (!baseUrl) {
    throw oauthError('provider_not_configured', 'OAuth callback URL is not configured.', 503);
  }

  try {
    const callbackUrl = new URL(`${provider}/callback`, `${baseUrl.replace(/\/+$/, '')}/`);
    if (!['http:', 'https:'].includes(callbackUrl.protocol)
      || (process.env.NODE_ENV === 'production' && callbackUrl.protocol !== 'https:')) {
      throw new Error('Unsupported callback URL protocol');
    }
    return callbackUrl.toString();
  } catch {
    throw oauthError('provider_not_configured', 'OAuth callback URL is invalid.', 503);
  }
};

const getProviderConfig = (provider) => {
  if (!providers.includes(provider)) {
    throw oauthError('unsupported_provider', 'This sign-in provider is not supported.', 404);
  }

  const configuration = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: 'openid email profile',
      usesPkce: true,
    },
    facebook: {
      clientId: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      authorizationUrl: `https://www.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION || 'v24.0'}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION || 'v24.0'}/oauth/access_token`,
      scopes: 'email,public_profile',
      usesPkce: false,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: 'read:user user:email',
      usesPkce: true,
    },
  }[provider];

  if (!configuration.clientId || !configuration.clientSecret) {
    throw oauthError('provider_not_configured', `${provider} sign-in is not configured.`, 503);
  }
  if (provider === 'facebook' && !/^v\d+\.\d+$/.test(process.env.FACEBOOK_GRAPH_VERSION || 'v24.0')) {
    throw oauthError('provider_not_configured', 'FACEBOOK_GRAPH_VERSION is invalid.', 503);
  }

  return { ...configuration, redirectUri: getCallbackUrl(provider) };
};

const getFrontendUrl = (page, values = {}) => {
  if (!process.env.FRONTEND_URL) {
    throw oauthError('frontend_not_configured', 'FRONTEND_URL is not configured.', 503);
  }

  let url;
  try {
    url = new URL(process.env.FRONTEND_URL);
    if (!['http:', 'https:'].includes(url.protocol)
      || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
      throw new Error('Unsupported frontend URL protocol');
    }
  } catch {
    throw oauthError('frontend_not_configured', 'FRONTEND_URL is invalid.', 503);
  }

  const query = new URLSearchParams(values);
  url.hash = `/${page}${query.size ? `?${query.toString()}` : ''}`;
  return url.toString();
};

const redirectWithError = (res, provider, errorCode) => {
  const values = { oauthError: errorCode };
  if (providers.includes(provider)) values.provider = provider;

  try {
    return res.redirect(303, getFrontendUrl('login', values));
  } catch {
    return res.status(503).json({
      success: false,
      message: 'OAuth sign-in is not configured. Configure FRONTEND_URL and provider credentials.',
    });
  }
};

const isSameState = (expected, actual) => (
  typeof expected === 'string'
  && typeof actual === 'string'
  && expected.length === actual.length
  && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
);

const fetchJson = async (url, options) => {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  } catch {
    throw oauthError('provider_unavailable', 'The identity provider could not be reached.', 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw oauthError('provider_response_invalid', 'The identity provider returned an invalid response.', 502);
  }

  if (!response.ok) {
    throw oauthError('provider_rejected', 'The identity provider could not verify this sign-in.', 401);
  }
  return payload;
};

const exchangeAuthorizationCode = async (provider, config, code, verifier) => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });
  const headers = { Accept: 'application/json' };

  if (provider === 'facebook') {
    const url = new URL(config.tokenUrl);
    params.forEach((value, key) => url.searchParams.set(key, value));
    const token = await fetchJson(url, { headers });
    return token.access_token;
  }

  params.set('grant_type', 'authorization_code');
  if (verifier) params.set('code_verifier', verifier);
  if (provider === 'github') {
    const token = await fetchJson(config.tokenUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    return token.access_token;
  }

  const token = await fetchJson(config.tokenUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  return token.access_token;
};

const getProviderProfile = async (provider, config, accessToken) => {
  if (!accessToken) {
    throw oauthError('provider_rejected', 'The identity provider did not issue an access token.', 401);
  }

  if (provider === 'google') {
    const profile = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      providerUserId: profile.sub,
      name: profile.name,
      email: profile.email,
      emailVerified: profile.email_verified === true || profile.email_verified === 'true',
    };
  }

  if (provider === 'facebook') {
    const profileUrl = new URL(`https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION || 'v24.0'}/me`);
    profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
    profileUrl.searchParams.set('access_token', accessToken);
    const profile = await fetchJson(profileUrl, {});
    return {
      providerUserId: profile.id,
      name: profile.name,
      email: profile.email,
      emailVerified: false,
      avatar: profile.picture?.data?.url,
    };
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'UtkriX-Website',
  };
  const [profile, emails] = await Promise.all([
    fetchJson('https://api.github.com/user', { headers }),
    fetchJson('https://api.github.com/user/emails', { headers }),
  ]);
  const primaryEmail = emails.find((item) => item.primary && item.verified);
  return {
    providerUserId: String(profile.id),
    name: profile.name || profile.login,
    email: primaryEmail?.email,
    emailVerified: Boolean(primaryEmail),
    avatar: profile.avatar_url,
  };
};

const assertUserCanSignIn = (user) => {
  if (!user || !user.isActive) {
    throw oauthError('account_inactive', 'This account is unavailable.', 403);
  }
  if (!user.emailVerified) {
    throw oauthError('email_verification_required', 'Verify your email before signing in.', 403);
  }
  if (user.role === 'instructor' && !user.isApproved) {
    throw oauthError('instructor_pending', 'Your instructor account is awaiting approval.', 403);
  }
};

const getOrCreateUser = async (provider, profile) => {
  if (!profile.providerUserId || typeof profile.email !== 'string') {
    throw oauthError('email_required', 'This provider did not share an email address.', 400);
  }

  const email = profile.email.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw oauthError('email_required', 'This provider did not share a valid email address.', 400);
  }

  const account = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
    include: { user: true },
  });
  if (account) {
    assertUserCanSignIn(account.user);
    return account.user;
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    if (!profile.emailVerified) {
      throw oauthError('account_conflict', 'Use your existing email sign-in for this account.', 409);
    }
    if (!user.isActive) {
      throw oauthError('account_inactive', 'This account is unavailable.', 403);
    }
    if (user.role === 'instructor' && !user.isApproved) {
      throw oauthError('instructor_pending', 'Your instructor account is awaiting approval.', 403);
    }
    if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }
    assertUserCanSignIn(user);
    await prisma.oAuthAccount.create({
      data: { provider, providerUserId: profile.providerUserId, userId: user.id },
    });
    return user;
  }

  if (!profile.emailVerified) assertEmailConfigured();

  const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  user = await prisma.user.create({
    data: {
      name: String(profile.name || email.split('@')[0]).slice(0, 100),
      email,
      password,
      role: 'student',
      tier: 'free',
      emailVerified: profile.emailVerified,
      isApproved: true,
      approvedAt: new Date(),
      avatar: profile.avatar || null,
      oauthAccounts: {
        create: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
    },
  });

  if (!profile.emailVerified) {
    const verificationToken = await createAuthToken(prisma, user.id, 'email_verification');
    await sendEmailVerification(user, verificationToken);
    throw oauthError('email_verification_required', 'Check your email to verify your account before signing in.', 403);
  }

  return user;
};

const controller = {};

controller.start = (req, res) => {
  const { provider } = req.params;
  try {
    const config = getProviderConfig(provider);
    const state = crypto.randomBytes(32).toString('hex');
    const authorizationUrl = new URL(config.authorizationUrl);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', config.scopes);
    authorizationUrl.searchParams.set('state', state);

    setOAuthCookie(res, provider, 'state', state, 600);
    if (config.usesPkce) {
      const verifier = crypto.randomBytes(48).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      authorizationUrl.searchParams.set('code_challenge', challenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');
      setOAuthCookie(res, provider, 'verifier', verifier, 600);
    }

    return res.redirect(302, authorizationUrl.toString());
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return redirectWithError(res, provider, error.oauthCode || 'provider_not_configured');
  }
};

controller.callback = async (req, res) => {
  const { provider } = req.params;
  const stateCookie = getCookie(req, cookieName(provider, 'state'));
  const verifier = getCookie(req, cookieName(provider, 'verifier'));
  clearOAuthCookies(res, provider);

  try {
    const config = getProviderConfig(provider);
    if (!isSameState(stateCookie, req.query.state)) {
      throw oauthError('invalid_state', 'The sign-in request expired. Please try again.', 400);
    }
    if (req.query.error) {
      throw oauthError('oauth_cancelled', 'Sign-in was cancelled.', 400);
    }
    if (typeof req.query.code !== 'string' || req.query.code.length > 2048) {
      throw oauthError('provider_rejected', 'The identity provider did not return an authorization code.', 400);
    }

    const accessToken = await exchangeAuthorizationCode(provider, config, req.query.code, verifier);
    const profile = await getProviderProfile(provider, config, accessToken);
    const user = await getOrCreateUser(provider, profile);
    assertUserCanSignIn(user);

    const code = await createAuthToken(prisma, user.id, 'oauth_exchange');
    return res.redirect(303, getFrontendUrl('auth/callback', { code }));
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) {
      logger.error('OAuth callback failed', { provider, error: error.name || 'Error' });
    }
    return redirectWithError(res, provider, error.oauthCode || 'provider_error');
  }
};

controller.exchange = async (req, res) => {
  try {
    let userId;
    await consumeAuthToken(prisma, req.body.code, 'oauth_exchange', async (_tx, id) => {
      userId = id;
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    assertUserCanSignIn(user);

    const refreshToken = await createRefreshToken(
      prisma,
      user.id,
      req.headers['user-agent'],
      req.ip
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const cookieSecure = isProduction ? true : false;
    const cookieSameSite = process.env.COOKIE_SAME_SITE || 'lax';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const csrfToken = req.cookies?.csrf_token || generateCSRFToken();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: 'Sign-in successful',
      token: issueAccessToken(user),
      csrfToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tier: user.tier,
        emailVerified: user.emailVerified,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Server error',
    });
  }
};

module.exports = controller;
