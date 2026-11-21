const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const oauthController = require('../controllers/oauthController');
const validate = require('../middleware/validationMiddleware');
const protect = require('../middleware/authMiddleware');
const { validateCSRF } = require('../middleware/csrfMiddleware');
const {
  authLimiter,
  loginLimiter,
  refreshLimiter,
  registrationLimiter,
  emailActionLimiter,
} = require('../middleware/rateLimitMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/oauth/{provider}:
 *   get:
 *     summary: Start provider sign-in
 *     tags: [Authentication]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, facebook, github] }
 *     responses:
 *       302:
 *         description: Redirect to the selected identity provider
 */
router.get('/oauth/:provider', authLimiter, oauthController.start);

/**
 * @swagger
 * /api/v1/auth/oauth/{provider}/callback:
 *   get:
 *     summary: Complete provider sign-in
 *     tags: [Authentication]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, facebook, github] }
 *     responses:
 *       303:
 *         description: Redirect to the website with a one-time sign-in code
 */
router.get('/oauth/:provider/callback', authLimiter, emailActionLimiter, oauthController.callback);

/**
 * @swagger
 * /api/v1/auth/oauth/exchange:
 *   post:
 *     summary: Exchange a one-time OAuth code for a website access token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, pattern: '^[a-f0-9]{64}$' }
 *     responses:
 *       200:
 *         description: Access token and user profile
 */
router.post(
  '/oauth/exchange',
  authLimiter,
  [body('code').isString().matches(/^[a-f0-9]{64}$/i).withMessage('A valid OAuth exchange code is required')],
  validate,
  oauthController.exchange
);

/**
 * @swagger
 * /api/v1/auth/csrf-token:
 *   get:
 *     summary: Get the CSRF token for cross-origin clients
 *     description: >-
 *       Returns the csrf_token cookie value so frontends hosted on sibling
 *       subdomains (which cannot read the API host's cookies via
 *       document.cookie) can send it back in the X-CSRF-Token header.
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Current CSRF token; cookie is set if missing
 */
router.get('/csrf-token', authController.getCsrfToken);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a student account
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12 }
 *     responses:
 *       201:
 *         description: Account created; email verification is required
 */
router.post(
  '/register',
  registrationLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters'),
  ],
  validate,
  authController.register
);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify an email address
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, minLength: 64, maxLength: 64 }
 *     responses:
 *       200:
 *         description: Email verified
 */
router.post(
  '/verify-email',
  authLimiter,
  [body('token').isString().isLength({ min: 64, max: 64 }).withMessage('A valid verification token is required')],
  validate,
  authController.verifyEmail
);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend email verification
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       202:
 *         description: Generic response to avoid disclosing account state
 */
router.post(
  '/resend-verification',
  emailActionLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  authController.resendVerification
);

/**
 * @swagger
 * /api/v1/auth/password-reset/request:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       202:
 *         description: Generic response to avoid disclosing account state
 */
router.post(
  '/password-reset/request',
  emailActionLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  authController.requestPasswordReset
);

/**
 * @swagger
 * /api/v1/auth/password-reset/confirm:
 *   post:
 *     summary: Reset a password using a one-time email token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string, minLength: 64, maxLength: 64 }
 *               password: { type: string, minLength: 12 }
 *     responses:
 *       200:
 *         description: Password reset and existing access tokens invalidated
 */
router.post(
  '/password-reset/confirm',
  authLimiter,
  [
    body('token').isString().isLength({ min: 64, max: 64 }).withMessage('A valid reset token is required'),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters'),
  ],
  validate,
  authController.resetPassword
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Sign in with email and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Access token and user profile
 */
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login
);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: New access token and updated refresh token cookie
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
  '/refresh',
  refreshLimiter,
  validateCSRF,
  authController.refresh
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and clear refresh token cookie
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post(
  '/logout',
  authLimiter,
  validateCSRF,
  authController.logout
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/me',
  protect,
  authController.me
);

module.exports = router;
