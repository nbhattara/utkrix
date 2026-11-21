const express = require('express');
const { body, param } = require('express-validator');
const teamMemberController = require('../controllers/teamMemberController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();
const optionalHttpUrl = (value) => !value || /^https?:\/\//i.test(value);

/**
 * @swagger
 * /api/v1/team-members:
 *   get:
 *     summary: List published team members
 *     tags: [Team]
 *     security: []
 *     responses:
 *       200:
 *         description: Published team member profiles in display order
 */
router.get('/', teamMemberController.getPublishedTeamMembers);

/**
 * @swagger
 * /api/v1/team-members/admin:
 *   get:
 *     summary: List all team members (admin only)
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team member profiles including drafts
 */
router.get('/admin', protect, authorize('admin'), teamMemberController.getAdminTeamMembers);

/**
 * @swagger
 * /api/v1/team-members:
 *   post:
 *     summary: Create a team member (admin only)
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Team member created
 */
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required and must be at most 100 characters'),
    body('title').trim().notEmpty().isLength({ max: 120 }).withMessage('Title is required and must be at most 120 characters'),
    body('bio').optional({ values: 'falsy' }).isLength({ max: 10000 }).withMessage('Bio must be at most 10000 characters'),
    body('photoUrl').optional({ values: 'falsy' }).isLength({ max: 2048 }).custom(optionalHttpUrl).withMessage('Photo URL must use http or https'),
    body('displayOrder').optional().isInt({ min: 0, max: 100000 }).withMessage('Display order must be a non-negative integer'),
    body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
  ],
  validate,
  teamMemberController.createTeamMember
);

/**
 * @swagger
 * /api/v1/team-members/{id}:
 *   put:
 *     summary: Update a team member (admin only)
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Team member updated
 *   delete:
 *     summary: Delete a team member (admin only)
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Team member deleted
 */
router.put(
  '/:id',
  protect,
  authorize('admin'),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid team member ID'),
    body('name').optional().trim().notEmpty().isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    body('title').optional().trim().notEmpty().isLength({ max: 120 }).withMessage('Title must be at most 120 characters'),
    body('bio').optional({ values: 'null' }).isLength({ max: 10000 }).withMessage('Bio must be at most 10000 characters'),
    body('photoUrl').optional({ values: 'null' }).isLength({ max: 2048 }).custom(optionalHttpUrl).withMessage('Photo URL must use http or https'),
    body('displayOrder').optional().isInt({ min: 0, max: 100000 }).withMessage('Display order must be a non-negative integer'),
    body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
  ],
  validate,
  teamMemberController.updateTeamMember
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Invalid team member ID')],
  validate,
  teamMemberController.deleteTeamMember
);

module.exports = router;
