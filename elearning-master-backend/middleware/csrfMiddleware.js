const crypto = require('crypto');
const AppError = require('../utils/AppError');

const CSRF_TOKEN_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

const generateCSRFToken = () => crypto.randomBytes(32).toString('hex');

const csrfProtection = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const method = req.method;
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (isSafeMethod) {
    const csrfToken = generateCSRFToken();

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const cookieSecure = isProduction ? true : false;
    const cookieSameSite = process.env.COOKIE_SAME_SITE || 'lax';

    res.cookie(CSRF_TOKEN_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.locals.csrfToken = csrfToken;
    return next();
  }

  const csrfTokenFromCookie = req.cookies[CSRF_TOKEN_COOKIE_NAME];
  const csrfTokenFromHeader = req.headers[CSRF_HEADER_NAME];

  if (!csrfTokenFromCookie || !csrfTokenFromHeader) {
    if (isDevelopment) {
      return next();
    }
    return next(new AppError('CSRF token missing', 403));
  }

  if (csrfTokenFromCookie !== csrfTokenFromHeader) {
    if (isDevelopment) {
      return next();
    }
    return next(new AppError('CSRF token mismatch', 403));
  }

  next();
};

const validateCSRF = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const csrfTokenFromCookie = req.cookies[CSRF_TOKEN_COOKIE_NAME];
  const csrfTokenFromHeader = req.headers[CSRF_HEADER_NAME];

  if (!csrfTokenFromCookie || !csrfTokenFromHeader) {
    if (isDevelopment) {
      return next();
    }
    return next(new AppError('CSRF token missing', 403));
  }

  if (csrfTokenFromCookie !== csrfTokenFromHeader) {
    if (isDevelopment) {
      return next();
    }
    return next(new AppError('CSRF token mismatch', 403));
  }

  next();
};

module.exports = {
  csrfProtection,
  validateCSRF,
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCSRFToken,
};
