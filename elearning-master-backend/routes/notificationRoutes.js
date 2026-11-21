const express = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('../controllers/notificationController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const AppError = require('../utils/AppError');

const router = express.Router();
router.use(protect);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(errors.array().map((error) => error.msg).join(', '), 400));
  return next();
};

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: List the caller's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest notifications and unread count
 */
router.get('/', controller.list);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   post:
 *     summary: Mark all of the caller's notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read
 */
router.post('/broadcast', authorize('admin'), [
  body('title').trim().isLength({ min: 3, max: 150 }).withMessage('Title must be 3-150 characters'),
  body('body').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
  body('imageUrl').optional({ nullable: true }).isURL().isLength({ max: 2048 }).withMessage('Image URL must be a valid URL'),
], validate, controller.createBroadcast);

router.post('/read-all', controller.markAllRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   put:
 *     summary: Mark one of the caller's notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found for this account
 */
router.put('/:id/read', [param('id').isInt({ min: 1 }).withMessage('Invalid notification ID.')], validate, controller.markRead);

module.exports = router;
