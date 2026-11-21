const express = require('express');
const { body, param, query } = require('express-validator');
const supportController = require('../controllers/supportController');
const protect = require('../middleware/authMiddleware');
const optionalProtect = require('../middleware/optionalAuthMiddleware');
const authorize = require('../middleware/roleMiddleware');
const { supportLimiter } = require('../middleware/rateLimitMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();
const channelParam = param('channel').isIn(['support', 'admin', 'moderator']).withMessage('Channel must be support, admin, or moderator');
const messageBody = body('message').trim().notEmpty().isLength({ max: 5000 }).withMessage('Message is required and must be under 5000 characters');
const inboxAccess = [protect, authorize('admin', 'moderator')];

/**
 * @swagger
 * /api/v1/support/guest-access:
 *   post:
 *     summary: Create a browser-bound guest chat access token
 *     tags: [Support]
 *     security: []
 *     responses:
 *       201:
 *         description: Guest access token issued; keep it private in this browser
 */
router.post(
  '/guest-access',
  supportLimiter,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('email').trim().isEmail().isLength({ max: 254 }).normalizeEmail(),
  ],
  validate,
  supportController.createGuestAccess
);

/**
 * @swagger
 * /api/v1/support/conversations/{channel}:
 *   get:
 *     summary: Get the signed-in user's or guest's conversation for a channel
 *     tags: [Support]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [support, admin, moderator] }
 *       - in: header
 *         name: X-Guest-Access-Token
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Conversation and recent messages
 *       404:
 *         description: No conversation has been started in this channel
 */
router.get('/conversations/:channel', optionalProtect, [channelParam], validate, supportController.getConversation);

/**
 * @swagger
 * /api/v1/support/conversations/{channel}:
 *   post:
 *     summary: Create or retrieve the user's single conversation for a channel
 *     tags: [Support]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [support, admin, moderator] }
 *       - in: header
 *         name: X-Guest-Access-Token
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Conversation opened
 */
router.post(
  '/conversations/:channel',
  optionalProtect,
  supportLimiter,
  [
    channelParam,
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('email').optional().trim().isEmail().isLength({ max: 254 }).normalizeEmail(),
  ],
  validate,
  supportController.startConversation
);

/**
 * @swagger
 * /api/v1/support/conversations/{channel}/messages:
 *   post:
 *     summary: Send a message to the selected support channel
 *     tags: [Support]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [support, admin, moderator] }
 *       - in: header
 *         name: X-Guest-Access-Token
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Message saved; email notification attempted
 */
router.post(
  '/conversations/:channel/messages',
  optionalProtect,
  supportLimiter,
  [channelParam, messageBody],
  validate,
  supportController.sendUserMessage
);

/**
 * @swagger
 * /api/v1/support/inbox/{channel}:
 *   get:
 *     summary: List conversations in the selected shared staff channel
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [support, admin, moderator] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Shared support conversations, most recent first
 */
router.get(
  '/inbox/:channel',
  ...inboxAccess,
  [
    channelParam,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  supportController.listConversations
);

/**
 * @swagger
 * /api/v1/support/inbox/{channel}/{conversationId}/messages:
 *   get:
 *     summary: Read a conversation in a shared staff inbox
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [support, admin, moderator] }
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Conversation with recent messages
 */
router.get(
  '/inbox/:channel/:conversationId/messages',
  ...inboxAccess,
  [
    channelParam,
    param('conversationId').isInt({ min: 1 }),
  ],
  validate,
  supportController.getStaffMessages
);

/**
 * @swagger
 * /api/v1/support/inbox/{channel}/{conversationId}/messages:
 *   post:
 *     summary: Reply to a user from the shared staff inbox
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [support, admin, moderator] }
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       201:
 *         description: Reply saved and email notification attempted
 */
router.post(
  '/inbox/:channel/:conversationId/messages',
  ...inboxAccess,
  [
    channelParam,
    param('conversationId').isInt({ min: 1 }),
    messageBody,
  ],
  validate,
  supportController.sendStaffReply
);

module.exports = router;
