const express = require('express');
const { body, param } = require('express-validator');
const faqController = require('../controllers/faqController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();

const faqFields = [
  body('question').trim().notEmpty().isLength({ max: 500 }).withMessage('Question is required and must be at most 500 characters'),
  body('answer').trim().notEmpty().isLength({ max: 10000 }).withMessage('Answer is required and must be at most 10000 characters'),
  body('displayOrder').optional().isInt({ min: 0, max: 100000 }).withMessage('Display order must be a non-negative integer'),
  body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
];

/**
 * @swagger
 * /api/v1/faqs:
 *   get:
 *     summary: List published FAQs
 *     tags: [FAQs]
 *     security: []
 *     responses:
 *       200:
 *         description: Published questions and answers in display order
 */
router.get('/', faqController.getPublishedFaqs);

/**
 * @swagger
 * /api/v1/faqs/admin:
 *   get:
 *     summary: List all FAQs including drafts
 *     tags: [FAQs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All FAQs in display order
 */
router.get('/admin', protect, authorize('admin'), faqController.getAdminFaqs);

/**
 * @swagger
 * /api/v1/faqs:
 *   post:
 *     summary: Create an FAQ (admin only)
 *     tags: [FAQs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, answer]
 *             properties:
 *               question: { type: string, maxLength: 500 }
 *               answer: { type: string, maxLength: 10000 }
 *               displayOrder: { type: integer, minimum: 0 }
 *               isPublished: { type: boolean }
 *     responses:
 *       201:
 *         description: FAQ created
 */
router.post('/', protect, authorize('admin'), faqFields, validate, faqController.createFaq);

/**
 * @swagger
 * /api/v1/faqs/{id}:
 *   put:
 *     summary: Update an FAQ (admin only)
 *     tags: [FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question: { type: string, maxLength: 500 }
 *               answer: { type: string, maxLength: 10000 }
 *               displayOrder: { type: integer, minimum: 0 }
 *               isPublished: { type: boolean }
 *     responses:
 *       200:
 *         description: FAQ updated
 *   delete:
 *     summary: Delete an FAQ (admin only)
 *     tags: [FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: FAQ deleted
 */
router.put(
  '/:id',
  protect,
  authorize('admin'),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid FAQ ID'),
    body('question').optional().trim().notEmpty().isLength({ max: 500 }).withMessage('Question must be at most 500 characters'),
    body('answer').optional().trim().notEmpty().isLength({ max: 10000 }).withMessage('Answer must be at most 10000 characters'),
    body('displayOrder').optional().isInt({ min: 0, max: 100000 }).withMessage('Display order must be a non-negative integer'),
    body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
  ],
  validate,
  faqController.updateFaq
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Invalid FAQ ID')],
  validate,
  faqController.deleteFaq
);

module.exports = router;
