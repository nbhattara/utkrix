const crypto = require('node:crypto');
const path = require('node:path');
const { prisma } = require('../config/prisma');
const { classroomUploadDirectory } = require('../middleware/classroomUploadMiddleware');
const storage = require('../services/storage/r2StorageService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const controller = {};
const joinCode = () => crypto.randomBytes(6).toString('hex').toUpperCase();
const courseIdFrom = (req) => Number(req.params.courseId);
const isManager = (user, course) => user.role === 'admin' || course.instructorId === user.id;

async function notifyEnrolledStudents(tx, courseId, courseTitle, type, subject, message) {
  const enrollments = await tx.courseEnrollment.findMany({
    where: { courseId },
    select: { studentId: true },
  });
  if (!enrollments.length) return;
  await tx.notification.createMany({
    data: enrollments.map(({ studentId }) => ({
      userId: studentId,
      type,
      title: `${subject}: ${message}`.slice(0, 150),
      body: courseTitle,
    })),
  });
}

async function getCourseOrThrow(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { instructor: { select: { id: true, name: true } } },
  });
  if (!course) throw new AppError('Class not found.', 404);
  return course;
}

async function assertClassAccess(user, course) {
  if (isManager(user, course)) return;
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: course.id, studentId: user.id } },
    select: { id: true },
  });
  if (!enrollment) throw new AppError('Join this class to view its classroom.', 403);
}

async function ensureJoinCode(course) {
  if (course.joinCode) return course.joinCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.course.updateMany({
        where: { id: course.id, joinCode: null },
        data: { joinCode: joinCode() },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }
    const refreshed = await prisma.course.findUnique({
      where: { id: course.id },
      select: { joinCode: true },
    });
    if (refreshed?.joinCode) return refreshed.joinCode;
  }
  throw new AppError('Could not generate a class code. Please try again.', 503);
}

async function removeUpload(file) {
  const key = file?.key || file?.filename || (file?.path ? path.basename(file.path) : null);
  if (!key) return;
  await storage.deleteObject({ key, visibility: 'private' }).catch((error) => {
    logger.error('Failed to remove classroom attachment', { message: error.message });
  });
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

controller.listClassrooms = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      const enrollments = await prisma.courseEnrollment.findMany({
        where: { studentId: req.user.id },
        include: {
          course: {
            include: {
              instructor: { select: { id: true, name: true } },
              _count: { select: { enrollments: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({
        classrooms: enrollments.map(({ course, createdAt }) => ({
          ...course,
          joinCode: undefined,
          enrolledAt: createdAt,
        })),
      });
    }

    const classrooms = await prisma.course.findMany({
      where: req.user.role === 'admin' ? {} : { instructorId: req.user.id },
      include: {
        instructor: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    const result = await Promise.all(classrooms.map(async (course) => ({
      ...course,
      joinCode: await ensureJoinCode(course),
    })));
    return res.json({ classrooms: result });
  } catch (error) {
    return next(error);
  }
};

controller.joinClassroom = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') throw new AppError('Only student accounts can join a class.', 403);
    const normalizedCode = String(req.body.joinCode || '').trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(normalizedCode)) throw new AppError('Enter a valid 12-character class code.', 400);

    const course = await prisma.course.findUnique({
      where: { joinCode: normalizedCode },
      include: { instructor: { select: { id: true, name: true } } },
    });
    if (!course) throw new AppError('No class was found for that code.', 404);

    const existing = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: req.user.id } },
    });
    if (existing) {
      return res.json({
        message: 'You are already in this class.',
        classroom: { ...course, joinCode: undefined },
      });
    }

    try {
      await prisma.courseEnrollment.create({
        data: { courseId: course.id, studentId: req.user.id },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }
    return res.status(201).json({
      message: 'You joined the class.',
      classroom: { ...course, joinCode: undefined },
    });
  } catch (error) {
    return next(error);
  }
};

controller.getClassroom = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    await assertClassAccess(req.user, course);

    const [announcements, materials, assignments] = await Promise.all([
      prisma.courseAnnouncement.findMany({ where: { courseId: course.id }, orderBy: { createdAt: 'desc' } }),
      prisma.courseMaterial.findMany({ where: { courseId: course.id }, orderBy: { createdAt: 'desc' } }),
      prisma.courseAssignment.findMany({ where: { courseId: course.id }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] }),
    ]);

    const classroom = isManager(req.user, course) ? course : { ...course, joinCode: undefined };
    return res.json({ classroom: { ...classroom, announcements, materials, assignments } });
  } catch (error) {
    return next(error);
  }
};

async function ensureCourseCertificate(courseId, studentId) {
  const [lessonCount, completedLessonCount, assignmentCount, gradedSubmissionCount] = await Promise.all([
    prisma.courseLesson.count({ where: { module: { courseId } } }),
    prisma.courseLessonProgress.count({ where: { studentId, lesson: { module: { courseId } } } }),
    prisma.courseAssignment.count({ where: { courseId } }),
    prisma.courseAssignmentSubmission.count({
      where: { studentId, grade: { not: null }, assignment: { courseId } },
    }),
  ]);
  if (!lessonCount || lessonCount !== completedLessonCount || assignmentCount !== gradedSubmissionCount) return null;

  return prisma.courseCertificate.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: {
      courseId,
      studentId,
      code: `UTX-${crypto.randomBytes(16).toString('hex').toUpperCase()}`,
    },
    update: {},
  });
}

controller.getLearningContent = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    await assertClassAccess(req.user, course);
    const isStudent = req.user.role === 'student';
    const [modules, assignments, certificate] = await Promise.all([
      prisma.courseModule.findMany({
        where: { courseId: course.id },
        include: {
          lessons: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            ...(isStudent ? { include: { progress: { where: { studentId: req.user.id }, select: { completedAt: true } } } } : {}),
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      prisma.courseAssignment.findMany({
        where: { courseId: course.id },
        include: {
          module: { select: { id: true, title: true } },
          ...(isStudent ? {
            submissions: {
              where: { studentId: req.user.id },
              select: { id: true, response: true, grade: true, feedback: true, submittedAt: true, gradedAt: true },
            },
          } : {
            _count: { select: { submissions: true } },
          }),
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      }),
      isStudent
        ? prisma.courseCertificate.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId: req.user.id } } })
        : Promise.resolve(null),
    ]);

    const totalLessons = modules.reduce((count, module) => count + module.lessons.length, 0);
    const completedLessons = modules.reduce((count, module) => count
      + module.lessons.filter((lesson) => lesson.progress?.length).length, 0);
    const studentAssignments = assignments.map(({ submissions = [], ...assignment }) => ({
      ...assignment,
      submission: submissions[0] || null,
    }));

    return res.json({
      modules: modules.map((module) => ({
        ...module,
        lessons: module.lessons.map(({ progress = [], ...lesson }) => ({
          ...lesson,
          completed: progress.length > 0,
        })),
      })),
      assignments: studentAssignments,
      progress: {
        totalLessons,
        completedLessons,
        percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      },
      certificate,
    });
  } catch (error) {
    return next(error);
  }
};

controller.createModule = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the assigned instructor can edit this course.', 403);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title || title.length > 150 || description.length > 10000) {
      throw new AppError('Enter a module title and keep its description under 10000 characters.', 400);
    }
    const lastModule = await prisma.courseModule.aggregate({
      where: { courseId: course.id },
      _max: { sortOrder: true },
    });
    const module = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        title,
        description: description || null,
        sortOrder: (lastModule._max.sortOrder ?? -1) + 1,
      },
    });
    return res.status(201).json({ module });
  } catch (error) {
    return next(error);
  }
};

controller.createLesson = async (req, res, next) => {
  let saved = false;
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the assigned instructor can edit this course.', 403);
    const moduleId = Number(req.params.moduleId);
    const module = await prisma.courseModule.findFirst({ where: { id: moduleId, courseId: course.id } });
    if (!module) throw new AppError('Course module not found.', 404);
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    const videoUrl = String(req.body.videoUrl || '').trim();
    const resourceUrl = String(req.body.resourceUrl || '').trim();
    if (!title || title.length > 150 || !content || content.length > 10000) {
      throw new AppError('Enter a lesson title and content (up to 10000 characters).', 400);
    }
    if ((videoUrl && !isHttpUrl(videoUrl)) || (resourceUrl && !isHttpUrl(resourceUrl))) {
      throw new AppError('Lesson links must use http or https.', 400);
    }
    const lastLesson = await prisma.courseLesson.aggregate({
      where: { moduleId: module.id },
      _max: { sortOrder: true },
    });
    const lesson = await prisma.$transaction(async (tx) => {
      const created = await tx.courseLesson.create({
        data: {
          moduleId: module.id,
          title,
          content,
          videoUrl: videoUrl || null,
          resourceUrl: resourceUrl || null,
          attachmentKey: req.file?.filename || req.body.attachmentKey || null,
          originalFileName: req.file?.originalname || req.body.originalFileName || null,
          sortOrder: (lastLesson._max.sortOrder ?? -1) + 1,
        },
      });
      await notifyEnrolledStudents(tx, course.id, course.title, 'lesson', 'New lesson', title);
      return created;
    });
    saved = true;
    return res.status(201).json({ lesson });
  } catch (error) {
    if (!saved) await removeUpload(req.file);
    return next(error);
  }
};

controller.deleteLearningItem = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the assigned instructor can edit this course.', 403);
    const id = Number(req.params.itemId);
    if (req.params.itemType === 'modules') {
      const existing = await prisma.courseModule.findFirst({ where: { id, courseId: course.id }, select: { id: true } });
      if (!existing) throw new AppError('Course module not found.', 404);
      const lessonFiles = await prisma.courseLesson.findMany({
        where: { moduleId: existing.id, attachmentKey: { not: null } },
        select: { attachmentKey: true },
      });
      await prisma.courseModule.delete({ where: { id: existing.id } });
      await Promise.all(lessonFiles.map(({ attachmentKey }) => removeUpload({ key: attachmentKey })));
    } else {
      const existing = await prisma.courseLesson.findFirst({
        where: { id, module: { courseId: course.id } },
        select: { id: true, attachmentKey: true },
      });
      if (!existing) throw new AppError('Course lesson not found.', 404);
      await prisma.courseLesson.delete({ where: { id: existing.id } });
      if (existing.attachmentKey) {
        await removeUpload({ key: existing.attachmentKey });
      }
    }
    return res.json({ message: 'Learning content deleted.' });
  } catch (error) {
    return next(error);
  }
};

controller.completeLesson = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') throw new AppError('Only students can update learning progress.', 403);
    const course = await getCourseOrThrow(courseIdFrom(req));
    await assertClassAccess(req.user, course);
    const lessonId = Number(req.params.lessonId);
    const lesson = await prisma.courseLesson.findFirst({
      where: { id: lessonId, module: { courseId: course.id } },
      select: { id: true },
    });
    if (!lesson) throw new AppError('Course lesson not found.', 404);
    await prisma.courseLessonProgress.upsert({
      where: { lessonId_studentId: { lessonId, studentId: req.user.id } },
      create: { lessonId, studentId: req.user.id },
      update: {},
    });
    const certificate = await ensureCourseCertificate(course.id, req.user.id);
    return res.json({ message: 'Lesson marked complete.', certificate });
  } catch (error) {
    return next(error);
  }
};

controller.submitAssignment = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') throw new AppError('Only students can submit assignments.', 403);
    const course = await getCourseOrThrow(courseIdFrom(req));
    await assertClassAccess(req.user, course);
    const assignmentId = Number(req.params.assignmentId);
    const assignment = await prisma.courseAssignment.findFirst({
      where: { id: assignmentId, courseId: course.id },
      select: { id: true },
    });
    if (!assignment) throw new AppError('Assignment not found.', 404);
    const response = String(req.body.response || '').trim();
    if (!response || response.length > 20000) throw new AppError('Enter your response (up to 20000 characters).', 400);
    const existing = await prisma.courseAssignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: req.user.id } },
      select: { id: true, grade: true },
    });
    if (existing?.grade !== null && existing?.grade !== undefined) {
      throw new AppError('This assignment has already been graded and cannot be resubmitted.', 409);
    }
    const submission = existing
      ? await prisma.courseAssignmentSubmission.update({
        where: { id: existing.id },
        data: { response, submittedAt: new Date(), grade: null, feedback: null, gradedAt: null },
      })
      : await prisma.courseAssignmentSubmission.create({
        data: { assignmentId, studentId: req.user.id, response },
      });
    return res.status(existing ? 200 : 201).json({ message: 'Assignment submitted.', submission });
  } catch (error) {
    return next(error);
  }
};

controller.listSubmissions = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the assigned instructor can review submissions.', 403);
    const submissions = await prisma.courseAssignmentSubmission.findMany({
      where: { assignment: { courseId: course.id } },
      include: {
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true, dueAt: true } },
      },
      orderBy: [{ gradedAt: 'asc' }, { submittedAt: 'asc' }],
    });
    return res.json({ submissions });
  } catch (error) {
    return next(error);
  }
};

controller.gradeSubmission = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the assigned instructor can grade submissions.', 403);
    const submissionId = Number(req.params.submissionId);
    const submission = await prisma.courseAssignmentSubmission.findFirst({
      where: { id: submissionId, assignment: { courseId: course.id } },
      select: { id: true, studentId: true, assignment: { select: { title: true } } },
    });
    if (!submission) throw new AppError('Assignment submission not found.', 404);
    const grade = Number(req.body.grade);
    const feedback = String(req.body.feedback || '').trim();
    if (!Number.isFinite(grade) || grade < 0 || grade > 100 || feedback.length > 10000) {
      throw new AppError('Enter a grade from 0 to 100 and feedback under 10000 characters.', 400);
    }
    const updated = await prisma.$transaction(async (tx) => {
      const graded = await tx.courseAssignmentSubmission.update({
        where: { id: submission.id },
        data: { grade, feedback: feedback || null, gradedAt: new Date() },
      });
      await tx.notification.create({
        data: {
          userId: submission.studentId,
          type: 'grade',
          title: 'Assignment graded',
          body: `Your submission for ${submission.assignment.title} in ${course.title} has been graded.`,
        },
      });
      return graded;
    });
    const certificate = await ensureCourseCertificate(course.id, submission.studentId);
    return res.json({ message: 'Submission graded.', submission: updated, certificate });
  } catch (error) {
    return next(error);
  }
};

controller.getRoster = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the class instructor can view its roster.', 403);

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId: course.id },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return res.json({ students: enrollments.map(({ student, createdAt }) => ({ ...student, enrolledAt: createdAt })) });
  } catch (error) {
    return next(error);
  }
};

controller.createAnnouncement = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the class instructor can post announcements.', 403);
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    if (!title || title.length > 150 || !body) throw new AppError('Enter a title and announcement.', 400);

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.courseAnnouncement.create({ data: { courseId: course.id, title, body } });
      await notifyEnrolledStudents(tx, course.id, course.title, 'announcement', 'New announcement', title);
      return created;
    });
    return res.status(201).json({ announcement });
  } catch (error) {
    return next(error);
  }
};

controller.createMaterial = async (req, res, next) => {
  let saved = false;
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the class instructor can add materials.', 403);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const url = String(req.body.url || '').trim();
    const kind = String(req.body.kind || 'note');
    if (!title || title.length > 150 || description.length > 10000) {
      throw new AppError('Enter a material title and keep the description under 10000 characters.', 400);
    }
    if (!['note', 'link', 'video', 'file'].includes(kind)) {
      throw new AppError('Choose a valid class post type.', 400);
    }
    if (url && !isHttpUrl(url)) {
      throw new AppError('Material links must use http or https.', 400);
    }
    if (kind === 'note' && !description) throw new AppError('Write a note before sharing it.', 400);
    if (kind === 'link' && !url) throw new AppError('Add a link before sharing it.', 400);
    if (kind === 'video' && !url && !req.file && !req.body.attachmentKey) throw new AppError('Add a video link or upload a video.', 400);
    if (kind === 'video' && req.file && !['video/mp4', 'video/webm'].includes(req.file.mimetype)) {
      throw new AppError('Upload an MP4 or WebM video for video posts.', 400);
    }
    if (kind === 'file' && !req.file && !req.body.attachmentKey) throw new AppError('Attach a file before sharing it.', 400);
    if (req.file && kind !== 'video' && ['video/mp4', 'video/webm'].includes(req.file.mimetype)) {
      throw new AppError('Choose Video for MP4 and WebM attachments.', 400);
    }

    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.courseMaterial.create({
        data: {
          courseId: course.id,
          kind,
          title,
          description: description || null,
          url: url || null,
          attachmentKey: req.file?.filename || req.body.attachmentKey || null,
          originalFileName: req.file?.originalname || req.body.originalFileName || null,
        },
      });
      await notifyEnrolledStudents(tx, course.id, course.title, 'material', 'New class material', title);
      return created;
    });
    saved = true;
    return res.status(201).json({ material });
  } catch (error) {
    if (!saved) await removeUpload(req.file);
    return next(error);
  }
};

controller.createAssignment = async (req, res, next) => {
  let saved = false;
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the class instructor can create assignments.', 403);
    const title = String(req.body.title || '').trim();
    const instructions = String(req.body.instructions || '').trim();
    const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    if (!title || title.length > 150 || !instructions || instructions.length > 10000) {
      throw new AppError('Enter a title and instructions (up to 10000 characters).', 400);
    }
    if (req.body.dueAt && Number.isNaN(dueAt.getTime())) {
      throw new AppError('Enter a valid due date.', 400);
    }
    const moduleId = req.body.moduleId ? Number(req.body.moduleId) : null;
    if (moduleId && !await prisma.courseModule.findFirst({ where: { id: moduleId, courseId: course.id }, select: { id: true } })) {
      throw new AppError('Choose a module in this course.', 400);
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.courseAssignment.create({
        data: {
          courseId: course.id,
          moduleId,
          title,
          instructions,
          dueAt,
          attachmentKey: req.file?.filename || req.body.attachmentKey || null,
          originalFileName: req.file?.originalname || req.body.originalFileName || null,
        },
      });
      await notifyEnrolledStudents(tx, course.id, course.title, 'assignment', 'New assignment', title);
      return created;
    });
    saved = true;
    return res.status(201).json({ assignment });
  } catch (error) {
    if (!saved) await removeUpload(req.file);
    return next(error);
  }
};

controller.deleteClassItem = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    if (!isManager(req.user, course)) throw new AppError('Only the class instructor can remove classroom posts.', 403);
    const id = Number(req.params.itemId);
    const models = {
      announcements: prisma.courseAnnouncement,
      materials: prisma.courseMaterial,
      assignments: prisma.courseAssignment,
    };
    const model = models[req.params.itemType];
    if (!model) throw new AppError('Invalid classroom item type.', 400);

    const existing = await model.findFirst({
      where: { id, courseId: course.id },
      select: { id: true, attachmentKey: true },
    });
    if (!existing) throw new AppError('Classroom post not found.', 404);
    await model.delete({ where: { id: existing.id } });
    if (existing.attachmentKey) {
      await removeUpload({ key: existing.attachmentKey });
    }
    return res.json({ message: 'Classroom post deleted.' });
  } catch (error) {
    return next(error);
  }
};

controller.downloadAttachment = async (req, res, next) => {
  try {
    const course = await getCourseOrThrow(courseIdFrom(req));
    await assertClassAccess(req.user, course);
    const id = Number(req.params.fileId);
    const models = {
      materials: prisma.courseMaterial,
      assignments: prisma.courseAssignment,
      lessons: prisma.courseLesson,
    };
    const model = models[req.params.itemType];
    if (!model) throw new AppError('Invalid classroom attachment type.', 400);
    const file = await model.findFirst({
      where: req.params.itemType === 'lessons'
        ? { id, module: { courseId: course.id } }
        : { id, courseId: course.id },
      select: { attachmentKey: true, originalFileName: true },
    });
    if (!file?.attachmentKey) throw new AppError('Attachment not found.', 404);
    const attachmentKey = path.basename(file.attachmentKey);
    const filePath = path.join(classroomUploadDirectory, attachmentKey);
    res.set('Cache-Control', 'private, no-store');
    const isVideo = ['materials', 'lessons'].includes(req.params.itemType)
      && /\.(mp4|webm)$/i.test(attachmentKey);
    if (storage.isR2Configured() && file.attachmentKey.includes('/')) {
      const url = await storage.getPresignedDownloadUrl({
        key: file.attachmentKey,
        visibility: 'private',
        expiresIn: 300,
        attachmentName: isVideo ? null : (file.originalFileName || 'classroom-attachment'),
      });
      if (url) return res.redirect(302, url);
    }
    if (isVideo) {
      res.type(path.extname(attachmentKey));
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) next(error);
      });
    }
    return res.download(filePath, file.originalFileName || 'classroom-attachment', (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  ...controller,
  normalizeJoinCode: (value) => String(value || '').trim().toUpperCase(),
};
