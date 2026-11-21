const express = require('express');
const { body, param } = require('express-validator');
const dashboardController = require('../controllers/dashboardController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get website administration statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account, course, and project counts
 */
router.get('/admin/dashboard', protect, authorize('admin'), dashboardController.getAdminDashboard);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List accounts for administration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accounts and their roles
 */
router.get('/admin/users', protect, authorize('admin'), dashboardController.getAllUsers);

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   put:
 *     summary: Update an account role and plan
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [student, instructor, admin, moderator] }
 *               tier: { type: string, enum: [free, premium] }
 *     responses:
 *       200:
 *         description: Account updated
 */
router.put(
  '/admin/users/:userId',
  protect,
  authorize('admin'),
  [
    param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
    body('role').optional().isIn(['student', 'instructor', 'admin', 'moderator']),
    body('tier').optional().isIn(['free', 'premium']),
  ],
  validate,
  dashboardController.updateUser
);

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   delete:
 *     summary: Deactivate an account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Account deactivated; its records are retained
 */
router.delete(
  '/admin/users/:userId',
  protect,
  authorize('admin'),
  [param('userId').isInt({ min: 1 }).withMessage('Invalid user ID')],
  validate,
  dashboardController.deleteUser
);

/**
 * @swagger
 * /api/v1/admin/pending-teachers:
 *   get:
 *     summary: List instructors awaiting approval
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending instructor accounts
 */
router.get('/admin/pending-teachers', protect, authorize('admin'), dashboardController.getPendingTeachers);

/**
 * @swagger
 * /api/v1/admin/approve-teacher/{teacherId}:
 *   put:
 *     summary: Approve an instructor account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Instructor approved and notified
 */
router.put(
  '/admin/approve-teacher/:teacherId',
  protect,
  authorize('admin'),
  [param('teacherId').isInt({ min: 1 }).withMessage('Invalid instructor ID')],
  validate,
  dashboardController.approveTeacher
);

module.exports = router;
