const express = require('express');
const { body, param, query } = require('express-validator');
const projectController = require('../controllers/projectController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const validate = require('../middleware/validationMiddleware');

const router = express.Router();

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isString().isLength({ max: 80 }).withMessage('Category is too long'),
  query('search').optional().isString().isLength({ max: 100 }).withMessage('Search is too long'),
];

const imageUrlValidation = body('imageUrl')
  .optional({ nullable: true })
  .custom((value) => {
    if (typeof value !== 'string') return false;
    if (value.startsWith('/uploads/') && !value.split('/').includes('..')) return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  })
  .withMessage('Image URL must be an HTTP, HTTPS, or /uploads/ URL');

const optionalProjectBodyValidation = [
  body('title').optional().trim().notEmpty().isLength({ max: 150 }).withMessage('Title must be 1 to 150 characters'),
  body('description').optional().trim().notEmpty().isLength({ max: 5000 }).withMessage('Description must be 1 to 5000 characters'),
  body('category').optional().trim().notEmpty().isLength({ max: 80 }).withMessage('Category must be 1 to 80 characters'),
  imageUrlValidation,
  body('projectUrl').optional({ nullable: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Project URL must be an HTTP or HTTPS URL'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Tags must be an array of at most 10 items'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 40 }).withMessage('Each tag must be 1 to 40 characters'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
  body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
  body('sortOrder').optional().isInt({ min: 0, max: 100000 }).withMessage('sortOrder must be a non-negative integer'),
];

const requiredProjectBodyValidation = [
  body('title').trim().notEmpty().isLength({ max: 150 }).withMessage('Title is required and must be at most 150 characters'),
  body('description').trim().notEmpty().isLength({ max: 5000 }).withMessage('Description is required and must be at most 5000 characters'),
  body('category').trim().notEmpty().isLength({ max: 80 }).withMessage('Category is required and must be at most 80 characters'),
  ...optionalProjectBodyValidation.slice(3),
];

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: List published projects
 *     tags: [Projects]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: category
 *         schema: { type: string, maxLength: 80 }
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Published projects, ordered for the public website
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Project' }
 */
router.get('/', paginationValidation, validate, projectController.getPublishedProjects);

/**
 * @swagger
 * /api/v1/projects/admin:
 *   get:
 *     summary: List all projects (admin only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isPublished
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Projects including drafts
 */
router.get(
  '/admin',
  protect,
  authorize('admin'),
  [...paginationValidation, query('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean')],
  validate,
  projectController.getAdminProjects
);

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create a project (admin only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category]
 *             properties:
 *               title: { type: string, maxLength: 150 }
 *               description: { type: string, maxLength: 5000 }
 *               category: { type: string, maxLength: 80 }
 *               imageUrl: { type: string, nullable: true, maxLength: 2048 }
 *               projectUrl: { type: string, format: uri, nullable: true }
 *               tags: { type: array, maxItems: 10, items: { type: string, maxLength: 40 } }
 *               isFeatured: { type: boolean, default: false }
 *               isPublished: { type: boolean, default: false }
 *               sortOrder: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       201: { description: Project created }
 */
router.post(
  '/',
  protect,
  authorize('admin'),
  requiredProjectBodyValidation,
  validate,
  projectController.createProject
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: Update a project (admin only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProjectUpdate' }
 *     responses:
 *       200: { description: Project updated }
 *       404: { description: Project not found }
 *   delete:
 *     summary: Delete a project (admin only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Project deleted }
 *       404: { description: Project not found }
 */
router.put(
  '/:id',
  protect,
  authorize('admin'),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    ...optionalProjectBodyValidation,
  ],
  validate,
  projectController.updateProject
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Invalid project ID')],
  validate,
  projectController.deleteProject
);

module.exports = router;
