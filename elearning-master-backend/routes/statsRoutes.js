const express = require('express');
const { body, param } = require('express-validator');
const statsController = require('../controllers/statsController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();
const sources = [
  'manual',
  'users',
  'students',
  'instructors',
  'courses',
  'publishedCourses',
  'projects',
  'publishedProjects',
  'teamMembers',
];
const metricFields = [
  body('label').trim().notEmpty().isLength({ max: 100 }).withMessage('Label is required and must be at most 100 characters'),
  body('source').isIn(sources).withMessage('Choose a supported metric source'),
  body('manualValue').optional({ values: 'falsy' }).isLength({ max: 50 }).withMessage('Manual value must be at most 50 characters'),
  body('prefix').optional().isLength({ max: 20 }).withMessage('Prefix must be at most 20 characters'),
  body('suffix').optional().isLength({ max: 20 }).withMessage('Suffix must be at most 20 characters'),
  body('displayOrder').optional().isInt({ min: 0, max: 100000 }).withMessage('Display order must be a non-negative integer'),
  body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
  body().custom((_, { req }) => {
    if (req.body.source === 'manual' && req.body.isPublished && !req.body.manualValue?.trim()) {
      throw new Error('Enter a manual value before publishing this statistic');
    }
    return true;
  }),
];

/**
 * @swagger
 * /api/v1/stats:
 *   get:
 *     summary: List published website statistics
 *     tags: [Statistics]
 *     security: []
 *     responses:
 *       200:
 *         description: Published metrics with manual values or live database counts
 */
router.get('/', statsController.getPublishedMetrics);

/**
 * @swagger
 * /api/v1/stats/admin:
 *   get:
 *     summary: List all website statistics (admin only)
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Published and draft metrics with current values
 */
router.get('/admin', protect, authorize('admin'), statsController.getAdminMetrics);

/**
 * @swagger
 * /api/v1/stats:
 *   post:
 *     summary: Create a website statistic (admin only)
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Statistic created
 */
router.post('/', protect, authorize('admin'), metricFields, validate, statsController.createMetric);

/**
 * @swagger
 * /api/v1/stats/{id}:
 *   put:
 *     summary: Update a website statistic (admin only)
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Statistic updated
 *   delete:
 *     summary: Delete a website statistic (admin only)
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Statistic deleted
 */
router.put(
  '/:id',
  protect,
  authorize('admin'),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid statistic ID'),
    ...metricFields,
  ],
  validate,
  statsController.updateMetric
);
router.delete('/:id', protect, authorize('admin'), [param('id').isInt({ min: 1 }).withMessage('Invalid statistic ID')], validate, statsController.deleteMetric);

module.exports = router;
