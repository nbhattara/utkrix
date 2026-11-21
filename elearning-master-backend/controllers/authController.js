const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');
const logger = require('../utils/logger');
const { createAuthToken, consumeAuthToken } = require('../services/authTokenService');
const { issueAccessToken } = require('../services/authService');
const {
  createRefreshToken,
  rotateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  hashToken,
} = require('../services/refreshTokenService');
const {
  assertEmailConfigured,
  sendEmailVerification,
  sendPasswordReset,
} = require('../services/emailService');
const { generateCSRFToken } = require('../middleware/csrfMiddleware');
const { resolveCookieDomain } = require('../utils/cookieDomain');

const csrfCookieOptions = (req) => ({
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  domain: resolveCookieDomain(req),
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});

// The csrf_token cookie lives on the API host, which frontend apps on sibling
// subdomains cannot read via document.cookie. Reuse an existing token so it
// stays stable across refreshes, and return it so callers can send it back in
// the X-CSRF-Token header.
const setAuthCookies = (res, req, refreshToken, existingCsrfToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = resolveCookieDomain(req);
  const cookieSecure = isProduction ? true : false;
  const cookieSameSite = process.env.COOKIE_SAME_SITE || 'lax';

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    domain: cookieDomain,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const csrfToken = existingCsrfToken || generateCSRFToken();
  res.cookie('csrf_token', csrfToken, csrfCookieOptions(req));

  return csrfToken;
};

const controller = {};

const respondWithError = (res, error, operation) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(`${operation} failed`, { message: error.message, stack: error.stack });
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Server error' : error.message,
  });
};

controller.register = async (req, res) => {
  try {
    assertEmailConfigured();

    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'student',
        tier: 'free',
        emailVerified: false,
        isApproved: true,
        approvedAt: new Date(),
      },
    });

    const verificationToken = await createAuthToken(prisma, user.id, 'email_verification');
    try {
      await sendEmailVerification(user, verificationToken);
    } catch (emailError) {
      await prisma.authToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      logger.error('Verification email delivery failed during registration', {
        message: emailError.message,
      });
      return res.status(503).json({
        success: false,
        message: 'Your account could not be created because the verification email could not be sent. Please try again later.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Check your email to verify your account.',
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
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    return respondWithError(res, error, 'Registration');
  }
};

controller.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Verify your email before signing in',
      });
    }
    if (user.role === 'instructor' && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your instructor account is awaiting administrator approval',
      });
    }

    const accessToken = issueAccessToken(user);
    const refreshToken = await createRefreshToken(
      prisma,
      user.id,
      req.headers['user-agent'],
      req.ip
    );

    const csrfToken = setAuthCookies(res, req, refreshToken, req.cookies?.csrf_token);

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
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
    return respondWithError(res, error, 'Login');
  }
};

controller.verifyEmail = async (req, res) => {
  try {
    await consumeAuthToken(prisma, req.body.token, 'email_verification', async (tx, userId) => {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });
    });

    return res.json({ success: true, message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    return respondWithError(res, error, 'Email verification');
  }
};

controller.resendVerification = async (req, res) => {
  try {
    assertEmailConfigured();
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user || user.emailVerified) {
      return res.status(202).json({
        success: true,
        message: 'If the account requires verification, an email will be sent.',
      });
    }

    const token = await createAuthToken(prisma, user.id, 'email_verification');
    await sendEmailVerification(user, token);
    return res.status(202).json({
      success: true,
      message: 'If the account requires verification, an email will be sent.',
    });
  } catch (error) {
    return respondWithError(res, error, 'Verification email delivery');
  }
};

controller.requestPasswordReset = async (req, res) => {
  try {
    assertEmailConfigured();
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user || !user.emailVerified) {
      return res.status(202).json({
        success: true,
        message: 'If a verified account exists for that email, reset instructions will be sent.',
      });
    }

    const token = await createAuthToken(prisma, user.id, 'password_reset');
    await sendPasswordReset(user, token);
    return res.status(202).json({
      success: true,
      message: 'If a verified account exists for that email, reset instructions will be sent.',
    });
  } catch (error) {
    return respondWithError(res, error, 'Password reset email delivery');
  }
};

controller.resetPassword = async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await consumeAuthToken(prisma, req.body.token, 'password_reset', async (tx, userId) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.authToken.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
    });

    return res.json({
      success: true,
      message: 'Password reset successfully. Sign in with your new password.',
    });
  } catch (error) {
    return respondWithError(res, error, 'Password reset');
  }
};

controller.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found',
      });
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    const result = await rotateRefreshToken(prisma, hashToken(refreshToken), userAgent, ipAddress);

    const csrfToken = setAuthCookies(res, req, result.refreshToken, req.cookies?.csrf_token);

    res.json({
      success: true,
      accessToken: result.accessToken,
      csrfToken,
      user: result.user,
    });
  } catch (error) {
    return respondWithError(res, error, 'Token refresh');
  }
};

controller.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await revokeRefreshToken(prisma, hashToken(refreshToken));
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = resolveCookieDomain(req);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      domain: cookieDomain,
      path: '/',
      maxAge: 0,
    });

    res.clearCookie('csrf_token', {
      httpOnly: false,
      secure: isProduction,
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      domain: cookieDomain,
      path: '/',
      maxAge: 0,
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    return respondWithError(res, error, 'Logout');
  }
};

controller.getCsrfToken = (req, res) => {
  const existing = req.cookies?.csrf_token;
  if (existing) {
    return res.json({ success: true, csrfToken: existing });
  }

  const csrfToken = generateCSRFToken();
  res.cookie('csrf_token', csrfToken, csrfCookieOptions(req));
  return res.json({ success: true, csrfToken });
};

controller.me = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    res.json({
      success: true,
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
    return respondWithError(res, error, 'Get current user');
  }
};

module.exports = controller;
