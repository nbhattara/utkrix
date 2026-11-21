const express = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('../controllers/classroomController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const { attachment } = require('../middleware/classroomUploadMiddleware');
const storage = require('../services/storage/r2StorageService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const router = express.Router();
router.use(protect);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(errors.array().map((error) => error.msg).join(', '), 400));
  return next();
};

const validateUploaded = async (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  if (req.file?.filename) {
    await storage.deleteObject({ key: req.file.filename, visibility: 'private' }).catch((error) => {
      logger.error('Failed to remove invalid classroom attachment', { message: error.message });
    });
  }
  return next(new AppError(errors.array().map((error) => error.msg).join(', '), 400));
};

/**
 * @swagger
 * /api/v1/classrooms:
 *   get:
 *     summary: List the caller's classrooms
 *     description: Instructors see only their assigned courses; students see their enrolled classrooms.
 *     tags: [Classrooms]
 *     responses:
 *       200:
 *         description: Classrooms available to the authenticated user
 */
router.get('/', authorize('instructor', 'student', 'admin'), controller.listClassrooms);

/**
 * @swagger
 * /api/v1/classrooms/join:
 *   post:
 *     summary: Join a classroom with its class code
 *     tags: [Classrooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [joinCode]
 *             properties:
 *               joinCode: { type: string, minLength: 12, maxLength: 12 }
 *     responses:
 *       201:
 *         description: Student joined the classroom
 *       403:
 *         description: Only students can join classrooms
 */
router.post(
  '/join',
  authorize('student'),
  [body('joinCode').trim().isLength({ min: 12, max: 12 }).withMessage('Enter a 12-character class code.')],
  validate,
  controller.joinClassroom
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}:
 *   get:
 *     summary: Read a classroom and its class stream
 *     tags: [Classrooms]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Classroom, announcements, materials, and assignments
 *       403:
 *         description: Caller does not own or belong to this classroom
 */
router.get(
  '/:courseId',
  authorize('instructor', 'student', 'admin'),
  [param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.')],
  validate,
  controller.getClassroom
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/learning:
 *   get:
 *     summary: Read a course curriculum and learner progress
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Course modules, lessons, assignments, progress, and certificate
 *       403:
 *         description: Caller does not own or belong to this classroom
 */
router.get(
  '/:courseId/learning',
  authorize('instructor', 'student', 'admin'),
  [param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.')],
  validate,
  controller.getLearningContent
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/modules:
 *   post:
 *     summary: Add a course module
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 150 }
 *               description: { type: string, maxLength: 10000 }
 *     responses:
 *       201:
 *         description: Module created
 *       403:
 *         description: Caller is not the assigned instructor or an administrator
 */
router.post(
  '/:courseId/modules',
  authorize('instructor', 'admin'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.'),
    body('title').trim().isLength({ min: 1, max: 150 }).withMessage('Module title is required and must be under 150 characters.'),
    body('description').optional().isLength({ max: 10000 }).withMessage('Module description must be under 10000 characters.'),
  ],
  validate,
  controller.createModule
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/modules/{moduleId}/lessons:
 *   post:
 *     summary: Add a lesson and optional private video or document
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string, maxLength: 150 }
 *               content: { type: string, maxLength: 10000 }
 *               videoUrl: { type: string, format: uri }
 *               resourceUrl: { type: string, format: uri }
 *               attachment: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Lesson created
 *       403:
 *         description: Caller is not the assigned instructor or an administrator
 */
router.post(
  '/:courseId/modules/:moduleId/lessons',
  authorize('instructor', 'admin'),
  attachment,
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.'),
    param('moduleId').isInt({ min: 1 }).withMessage('Invalid module ID.'),
    body('title').trim().isLength({ min: 1, max: 150 }).withMessage('Lesson title is required and must be under 150 characters.'),
    body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('Lesson content is required and must be under 10000 characters.'),
    body('videoUrl').optional({ checkFalsy: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Enter a valid video URL.'),
    body('resourceUrl').optional({ checkFalsy: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Enter a valid resource URL.'),
  ],
  validateUploaded,
  controller.createLesson
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/learning/{itemType}/{itemId}:
 *   delete:
 *     summary: Delete a module or lesson
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemType
 *         required: true
 *         schema: { type: string, enum: [modules, lessons] }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Learning content deleted
 */
router.delete(
  '/:courseId/learning/:itemType/:itemId',
  authorize('instructor', 'admin'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.'),
    param('itemType').isIn(['modules', 'lessons']).withMessage('Invalid learning content type.'),
    param('itemId').isInt({ min: 1 }).withMessage('Invalid learning content ID.'),
  ],
  validate,
  controller.deleteLearningItem
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/lessons/{lessonId}/complete:
 *   post:
 *     summary: Mark an enrolled student's lesson complete
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lesson progress saved; a certificate is issued when course requirements are met
 */
router.post(
  '/:courseId/lessons/:lessonId/complete',
  authorize('student'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.'),
    param('lessonId').isInt({ min: 1 }).withMessage('Invalid lesson ID.'),
  ],
  validate,
  controller.completeLesson
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/assignments/{assignmentId}/submissions:
 *   post:
 *     summary: Submit or update an assignment response
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response: { type: string, maxLength: 20000 }
 *     responses:
 *       201:
 *         description: Assignment submitted
 */
router.post(
  '/:courseId/assignments/:assignmentId/submissions',
  authorize('student'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.'),
    param('assignmentId').isInt({ min: 1 }).withMessage('Invalid assignment ID.'),
    body('response').trim().isLength({ min: 1, max: 20000 }).withMessage('Enter your response (up to 20000 characters).'),
  ],
  validate,
  controller.submitAssignment
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/submissions:
 *   get:
 *     summary: List submissions for an assigned course
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student submissions and grading details
 *       403:
 *         description: Caller is not the assigned instructor or an administrator
 */
router.get(
  '/:courseId/submissions',
  authorize('instructor', 'admin'),
  [param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.')],
  validate,
  controller.listSubmissions
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/submissions/{submissionId}/grade:
 *   put:
 *     summary: Grade a student's assignment submission
 *     tags: [Classrooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [grade]
 *             properties:
 *               grade: { type: number, minimum: 0, maximum: 100 }
 *               feedback: { type: string, maxLength: 10000 }
 *     responses:
 *       200:
 *         description: Submission graded
 *       403:
 *         description: Caller is not the assigned instructor or an administrator
 */
router.put(
  '/:courseId/submissions/:submissionId/grade',
  authorize('instructor', 'admin'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid course ID.'),
    param('submissionId').isInt({ min: 1 }).withMessage('Invalid submission ID.'),
    body('grade').isFloat({ min: 0, max: 100 }).withMessage('Grade must be between 0 and 100.'),
    body('feedback').optional().isLength({ max: 10000 }).withMessage('Feedback must be under 10000 characters.'),
  ],
  validate,
  controller.gradeSubmission
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/roster:
 *   get:
 *     summary: Read the roster for an assigned classroom
 *     tags: [Classrooms]
 *     responses:
 *       200:
 *         description: Enrolled students
 *       403:
 *         description: Caller is not the assigned instructor or an administrator
 */
router.get(
  '/:courseId/roster',
  authorize('instructor', 'admin'),
  [param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.')],
  validate,
  controller.getRoster
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/announcements:
 *   post:
 *     summary: Post an announcement to an assigned classroom
 *     tags: [Classrooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string, maxLength: 150 }
 *               body: { type: string, maxLength: 10000 }
 *     responses:
 *       201:
 *         description: Announcement posted to the class stream
 */
router.post(
  '/:courseId/announcements',
  authorize('instructor', 'admin'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.'),
    body('title').trim().isLength({ min: 1, max: 150 }).withMessage('Title is required and must be under 150 characters.'),
    body('body').trim().isLength({ min: 1, max: 10000 }).withMessage('Announcement is required and must be under 10000 characters.'),
  ],
  validate,
  controller.createAnnouncement
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/materials:
 *   post:
 *     summary: Share a note, link, video, or file with a classroom
 *     tags: [Classrooms]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               kind: { type: string, enum: [note, link, video, file] }
 *               title: { type: string, maxLength: 150 }
 *               description: { type: string, maxLength: 10000 }
 *               url: { type: string, format: uri }
 *               attachment: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Material posted to the class stream
 */
router.post(
  '/:courseId/materials',
  authorize('instructor', 'admin'),
  attachment,
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.'),
    body('title').trim().isLength({ min: 1, max: 150 }).withMessage('Title is required and must be under 150 characters.'),
    body('description').optional().isLength({ max: 10000 }).withMessage('Description must be under 10000 characters.'),
    body('kind').optional().isIn(['note', 'link', 'video', 'file']).withMessage('Choose a valid class post type.'),
    body('url').optional({ checkFalsy: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Enter a valid http or https link.'),
  ],
  validateUploaded,
  controller.createMaterial
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/assignments:
 *   post:
 *     summary: Create an assignment in an assigned classroom
 *     tags: [Classrooms]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, instructions]
 *             properties:
 *               title: { type: string, maxLength: 150 }
 *               instructions: { type: string, maxLength: 10000 }
 *               dueAt: { type: string, format: date-time }
 *               attachment: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Assignment posted to the class stream
 */
router.post(
  '/:courseId/assignments',
  authorize('instructor', 'admin'),
  attachment,
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.'),
    body('title').trim().isLength({ min: 1, max: 150 }).withMessage('Title is required and must be under 150 characters.'),
    body('instructions').trim().isLength({ min: 1, max: 10000 }).withMessage('Instructions are required and must be under 10000 characters.'),
    body('dueAt').optional({ checkFalsy: true }).isISO8601().withMessage('Enter a valid due date.'),
    body('moduleId').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Choose a valid course module.'),
  ],
  validateUploaded,
  controller.createAssignment
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/{itemType}/{itemId}:
 *   delete:
 *     summary: Delete a post from an assigned classroom
 *     tags: [Classrooms]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemType
 *         required: true
 *         schema: { type: string, enum: [announcements, materials, assignments] }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Classroom post deleted
 */
router.delete(
  '/:courseId/:itemType/:itemId',
  authorize('instructor', 'admin'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.'),
    param('itemType').isIn(['announcements', 'materials', 'assignments']).withMessage('Invalid classroom post type.'),
    param('itemId').isInt({ min: 1 }).withMessage('Invalid classroom post ID.'),
  ],
  validate,
  controller.deleteClassItem
);

/**
 * @swagger
 * /api/v1/classrooms/{courseId}/files/{itemType}/{fileId}:
 *   get:
 *     summary: Download or stream an enrolled classroom file
 *     tags: [Classrooms]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemType
 *         required: true
 *         schema: { type: string, enum: [materials, assignments, lessons] }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Classroom attachment
 *       403:
 *         description: Caller is not enrolled in this classroom
 */
router.get(
  '/:courseId/files/:itemType/:fileId',
  authorize('instructor', 'student', 'admin'),
  [
    param('courseId').isInt({ min: 1 }).withMessage('Invalid class ID.'),
    param('fileId').isInt({ min: 1 }).withMessage('Invalid file ID.'),
    param('itemType').isIn(['materials', 'assignments', 'lessons']).withMessage('Invalid attachment type.'),
  ],
  validate,
  controller.downloadAttachment
);

module.exports = router;
