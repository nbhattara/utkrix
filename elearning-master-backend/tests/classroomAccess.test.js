require('dotenv').config();

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const test = require('node:test');
const { prisma } = require('../config/prisma');

const originalUserFindUnique = prisma.user.findUnique;
const originalCourseFindUnique = prisma.course.findUnique;
const originalCourseFindMany = prisma.course.findMany;
const originalEnrollmentFindUnique = prisma.courseEnrollment.findUnique;
const originalEnrollmentFindMany = prisma.courseEnrollment.findMany;
const originalAnnouncementCreate = prisma.courseAnnouncement.create;
const originalTransaction = prisma.$transaction;

async function createTestServer(t, user) {
  prisma.user.findUnique = async ({ where }) => where.id === user.id ? user : null;
  prisma.courseEnrollment.findMany = async () => [];
  prisma.$transaction = async (callback) => callback(prisma);
  const app = express();
  app.use(express.json());
  app.use('/api/v1/classrooms', require('../routes/classroomRoutes'));
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    prisma.user.findUnique = originalUserFindUnique;
    prisma.course.findUnique = originalCourseFindUnique;
    prisma.course.findMany = originalCourseFindMany;
    prisma.courseEnrollment.findUnique = originalEnrollmentFindUnique;
    prisma.courseEnrollment.findMany = originalEnrollmentFindMany;
    prisma.courseAnnouncement.create = originalAnnouncementCreate;
    prisma.$transaction = originalTransaction;
  });

  const token = jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    tier: user.tier,
    tokenVersion: user.tokenVersion,
  }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/api/v1/classrooms`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

test('instructors can only read and post to courses assigned to them', async (t) => {
  const instructor = {
    id: 21,
    name: 'Instructor',
    email: 'instructor@example.test',
    role: 'instructor',
    tier: 'free',
    tokenVersion: 0,
    emailVerified: true,
    isActive: true,
    isApproved: true,
  };
  let queriedCourseFilter;
  let announcementCreated = false;

  prisma.course.findMany = async ({ where }) => {
    queriedCourseFilter = where;
    return [];
  };
  prisma.course.findUnique = async ({ where }) => ({
    id: Number(where.id),
    instructorId: Number(where.id) === 42 ? instructor.id : 99,
    title: 'Assigned classroom',
    instructor: { id: instructor.id, name: instructor.name },
  });
  prisma.courseAnnouncement.create = async ({ data }) => {
    announcementCreated = true;
    return { id: 1, ...data, createdAt: new Date() };
  };

  const { baseUrl, headers } = await createTestServer(t, instructor);
  const listResponse = await fetch(baseUrl, { headers });
  assert.equal(listResponse.status, 200);
  assert.deepEqual(queriedCourseFilter, { instructorId: instructor.id });

  const forbiddenResponse = await fetch(`${baseUrl}/41`, { headers });
  assert.equal(forbiddenResponse.status, 403);

  const forbiddenPost = await fetch(`${baseUrl}/41/announcements`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Not assigned', body: 'Must not be posted.' }),
  });
  assert.equal(forbiddenPost.status, 403);
  assert.equal(announcementCreated, false);

  const assignedPost = await fetch(`${baseUrl}/42/announcements`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Assigned', body: 'This post belongs to the assigned class.' }),
  });
  assert.equal(assignedPost.status, 201);
  assert.equal(announcementCreated, true);
});

test('students cannot post and non-enrolled students cannot read a classroom', async (t) => {
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
  let enrollmentChecked = false;
  prisma.course.findUnique = async ({ where }) => ({
    id: Number(where.id),
    instructorId: 21,
    title: 'Private classroom',
    instructor: { id: 21, name: 'Instructor' },
  });
  prisma.courseEnrollment.findUnique = async () => {
    enrollmentChecked = true;
    return null;
  };

  const { baseUrl, headers } = await createTestServer(t, student);
  const postResponse = await fetch(`${baseUrl}/42/announcements`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Student post', body: 'Students are read-only.' }),
  });
  assert.equal(postResponse.status, 403);
  assert.equal(enrollmentChecked, false);

  const readResponse = await fetch(`${baseUrl}/42`, { headers });
  assert.equal(readResponse.status, 403);
  assert.equal(enrollmentChecked, true);
});
