const express = require('express');
const { body, query } = require('express-validator');
const contactController = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimitMiddleware');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/contact:
 *   post:
 *     summary: Send a website contact message
 *     tags: [Contact]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 254
 *               phone:
 *                 type: string
 *                 maxLength: 16
 *                 description: Optional callback number.
 *               subject:
 *                 type: string
 *                 maxLength: 150
 *               message:
 *                 type: string
 *                 maxLength: 5000
 *               website:
 *                 type: string
 *                 description: Honeypot field; leave empty.
 *     responses:
 *       201:
 *         description: Message stored and email notification attempted
 *       400:
 *         description: Invalid form submission
 *       503:
 *         description: Message could not be stored
 */
router.post(
  '/',
  contactLimiter,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required and must be under 100 characters'),
    body('email')
      .trim()
      .isLength({ max: 254 })
      .isEmail()
      .normalizeEmail()
      .withMessage('Enter a valid email address under 255 characters'),
    body('phone')
      .optional({ values: 'falsy' })
      .trim()
      .matches(/^[+()\d\s-]{7,16}$/)
      .withMessage('Phone must contain 7 to 16 digits or phone punctuation characters'),
    body('subject').trim().notEmpty().isLength({ max: 150 }).withMessage('Subject is required and must be under 150 characters'),
    body('message').trim().notEmpty().isLength({ max: 5000 }).withMessage('Message is required and must be under 5000 characters'),
    body('website').optional().isString().isLength({ max: 200 }),
  ],
  validate,
  contactController.submitContactMessage
);

/**
 * @swagger
 * /api/v1/contact/admin:
 *   get:
 *     summary: List contact form messages for admins and moderators
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Contact messages, newest first
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin or moderator role required
 */
router.get(
  '/admin',
  protect,
  authorize('admin', 'moderator'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  contactController.getContactMessages
);

module.exports = router;
