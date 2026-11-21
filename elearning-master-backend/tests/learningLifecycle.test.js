require('dotenv').config();

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const test = require('node:test');
const { prisma } = require('../config/prisma');

const prismaMethods = [
  [prisma.user, 'findUnique'],
  [prisma.course, 'findUnique'],
  [prisma.courseEnrollment, 'findUnique'],
  [prisma.courseLesson, 'findFirst'],
  [prisma.courseLesson, 'count'],
  [prisma.courseLessonProgress, 'upsert'],
  [prisma.courseLessonProgress, 'count'],
  [prisma.courseAssignment, 'findFirst'],
  [prisma.courseAssignment, 'count'],
  [prisma.courseAssignmentSubmission, 'findUnique'],
  [prisma.courseAssignmentSubmission, 'create'],
  [prisma.courseAssignmentSubmission, 'count'],
  [prisma.courseCertificate, 'upsert'],
  [prisma.notification, 'findMany'],
  [prisma.notification, 'count'],
  [prisma.notification, 'findFirst'],
  [prisma.notification, 'update'],
  [prisma.notification, 'updateMany'],
];
const originalMethods = prismaMethods.map(([delegate, method]) => delegate[method]);

async function createStudentServer(t, enrolled) {
  const student = {
    id: 31,
    name: 'Student',
    email: 'student@example.test',
    role: 'student',
    tier: 'free',
    tokenVersion: 0,
    emailVerified: true,
    isActive: true,
    isApproved: true,
  };
  prisma.user.findUnique = async ({ where }) => where.id === student.id ? student : null;
  prisma.course.findUnique = async ({ where }) => ({
    id: Number(where.id),
    instructorId: 21,
    title: 'Learning course',
    instructor: { id: 21, name: 'Instructor' },
  });
  prisma.courseEnrollment.findUnique = async () => enrolled ? { id: 1 } : null;

  const app = express();
  app.use(express.json());
  app.use('/api/v1/classrooms', require('../routes/classroomRoutes'));
  app.use('/api/v1/notifications', require('../routes/notificationRoutes'));
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    prismaMethods.forEach(([delegate, method], index) => {
      delegate[method] = originalMethods[index];
    });
  });
  const token = jwt.sign({
    id: student.id,
    email: student.email,
    role: student.role,
    tier: student.tier,
    tokenVersion: student.tokenVersion,
  }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl: `${origin}/api/v1/classrooms`,
    notificationUrl: `${origin}/api/v1/notifications`,
    headers: { authorization: 'Bearer'.concat(' ', token) },
  };
}

test('enrolled students can complete lessons and receive a certificate at course completion', async (t) => {
  let progressSaved = false;
  let certificateIssued = false;
  prisma.courseLesson.findFirst = async () => ({ id: 7 });
  prisma.courseLessonProgress.upsert = async () => { progressSaved = true; return { id: 1 }; };
  prisma.courseLesson.count = async () => 1;
  prisma.courseLessonProgress.count = async () => 1;
  prisma.courseAssignment.count = async () => 0;
  prisma.courseAssignmentSubmission.count = async () => 0;
  prisma.courseCertificate.upsert = async ({ create }) => {
    certificateIssued = true;
    return { ...create, issuedAt: new Date('2026-11-04T00:00:00Z') };
  };

  const { baseUrl, headers } = await createStudentServer(t, true);
  const response = await fetch(`${baseUrl}/42/lessons/7/complete`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(progressSaved, true);
  assert.equal(certificateIssued, true);
  assert.match(result.certificate.code, /^UTX-/);
});

test('students outside a course cannot complete its lessons or submit assignments', async (t) => {
  let lessonTouched = false;
  let assignmentTouched = false;
  prisma.courseLesson.findFirst = async () => { lessonTouched = true; return { id: 7 }; };
  prisma.courseAssignment.findFirst = async () => { assignmentTouched = true; return { id: 8 }; };

  const { baseUrl, headers } = await createStudentServer(t, false);
  const lessonResponse = await fetch(`${baseUrl}/42/lessons/7/complete`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const submissionResponse = await fetch(`${baseUrl}/42/assignments/8/submissions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: 'My assignment response.' }),
  });

  assert.equal(lessonResponse.status, 403);
  assert.equal(submissionResponse.status, 403);
  assert.equal(lessonTouched, false);
  assert.equal(assignmentTouched, false);
});

test('enrolled students can submit an assignment response', async (t) => {
  let submissionCreated = false;
  prisma.courseAssignment.findFirst = async () => ({ id: 8 });
  prisma.courseAssignmentSubmission.findUnique = async () => null;
  prisma.courseAssignmentSubmission.create = async ({ data }) => {
    submissionCreated = true;
    return { id: 13, ...data, grade: null, feedback: null };
  };

  const { baseUrl, headers } = await createStudentServer(t, true);
  const response = await fetch(`${baseUrl}/42/assignments/8/submissions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: 'My assignment response.' }),
  });
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(submissionCreated, true);
  assert.equal(result.submission.response, 'My assignment response.');
});

test('notification reads and updates are scoped to the signed-in account', async (t) => {
  let notificationFilter;
  let updateFilter;
  prisma.notification.findMany = async ({ where }) => {
    notificationFilter = where;
    return [{ id: 5, userId: 31, type: 'grade', title: 'Assignment graded', body: 'Feedback is ready.', readAt: null }];
  };
  prisma.notification.count = async ({ where }) => where.userId === 31 ? 1 : 0;
  prisma.notification.findFirst = async ({ where }) => {
    assert.equal(where.userId, 31);
    return { id: where.id, readAt: null };
  };
  prisma.notification.update = async ({ where, data }) => {
    updateFilter = where;
    return { id: where.id, readAt: data.readAt };
  };

  const { notificationUrl, headers } = await createStudentServer(t, true);
  const listResponse = await fetch(notificationUrl, { headers });
  const list = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.deepEqual(notificationFilter, { userId: 31 });
  assert.equal(list.unreadCount, 1);
  assert.equal(list.notifications[0].id, 5);

  const readResponse = await fetch(`${notificationUrl}/5/read`, { method: 'PUT', headers });
  assert.equal(readResponse.status, 200);
  assert.deepEqual(updateFilter, { id: 5 });
});
