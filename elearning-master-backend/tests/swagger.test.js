const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const PROJECT_ROOT = path.join(__dirname, '..');
process.chdir(PROJECT_ROOT);

const swaggerSpec = require('../config/swagger');
const { findDanglingRefs } = require('../scripts/lib/openapiValidator');
const SPEC_FILE_PATH = path.join(PROJECT_ROOT, 'openapi.json');

test('the generated document is a valid OpenAPI 3.0.0 spec', () => {
  assert.equal(swaggerSpec.openapi, '3.0.0');
  assert.equal(swaggerSpec.info.title, 'UtkriX Technologies API');
  assert.ok(swaggerSpec.components.securitySchemes.bearerAuth);
});

test('every documented reference resolves', () => {
  assert.deepEqual(findDanglingRefs(swaggerSpec), []);
});

test('website-facing public routes do not require authentication', () => {
  const publicOperations = [
    ['post', '/api/v1/contact'],
    ['post', '/api/v1/support/guest-access'],
    ['get', '/api/v1/support/conversations/{channel}'],
    ['post', '/api/v1/support/conversations/{channel}'],
    ['post', '/api/v1/support/conversations/{channel}/messages'],
    ['post', '/api/v1/auth/login'],
    ['post', '/api/v1/auth/register'],
    ['post', '/api/v1/auth/verify-email'],
    ['post', '/api/v1/auth/resend-verification'],
    ['post', '/api/v1/auth/password-reset/request'],
    ['post', '/api/v1/auth/password-reset/confirm'],
    ['get', '/api/v1/auth/oauth/{provider}'],
    ['post', '/api/v1/auth/oauth/exchange'],
    ['get', '/api/v1/courses'],
    ['get', '/api/v1/courses/categories'],
    ['get', '/api/v1/projects'],
    ['get', '/api/v1/faqs'],
    ['get', '/api/health'],
  ];

  for (const [method, route] of publicOperations) {
    assert.deepEqual(swaggerSpec.paths[route]?.[method]?.security, [], `${method.toUpperCase()} ${route}`);
  }
});

test('frontend dashboard and content operations are documented', () => {
  const frontendOperations = [
    ['get', '/api/v1/courses/manage'],
    ['post', '/api/v1/courses'],
    ['put', '/api/v1/courses/{id}'],
    ['delete', '/api/v1/courses/{id}'],
    ['get', '/api/v1/projects/admin'],
    ['post', '/api/v1/projects'],
    ['put', '/api/v1/projects/{id}'],
    ['delete', '/api/v1/projects/{id}'],
    ['get', '/api/v1/faqs/admin'],
    ['post', '/api/v1/faqs'],
    ['put', '/api/v1/faqs/{id}'],
    ['delete', '/api/v1/faqs/{id}'],
    ['get', '/api/v1/admin/dashboard'],
    ['get', '/api/v1/contact/admin'],
    ['get', '/api/v1/support/inbox/{channel}'],
    ['get', '/api/v1/support/inbox/{channel}/{conversationId}/messages'],
    ['post', '/api/v1/support/inbox/{channel}/{conversationId}/messages'],
    ['get', '/api/v1/admin/users'],
    ['put', '/api/v1/admin/users/{userId}'],
    ['delete', '/api/v1/admin/users/{userId}'],
    ['get', '/api/v1/admin/pending-teachers'],
    ['put', '/api/v1/admin/approve-teacher/{teacherId}'],
  ];

  for (const [method, route] of frontendOperations) {
    assert.ok(swaggerSpec.paths[route]?.[method], `Missing ${method.toUpperCase()} ${route}`);
  }
});

test('classroom curriculum, progress, submission, and grading operations are documented', () => {
  const lifecycleOperations = [
    ['get', '/api/v1/classrooms/{courseId}/learning'],
    ['post', '/api/v1/classrooms/{courseId}/modules'],
    ['post', '/api/v1/classrooms/{courseId}/modules/{moduleId}/lessons'],
    ['delete', '/api/v1/classrooms/{courseId}/learning/{itemType}/{itemId}'],
    ['post', '/api/v1/classrooms/{courseId}/lessons/{lessonId}/complete'],
    ['post', '/api/v1/classrooms/{courseId}/assignments/{assignmentId}/submissions'],
    ['get', '/api/v1/classrooms/{courseId}/submissions'],
    ['put', '/api/v1/classrooms/{courseId}/submissions/{submissionId}/grade'],
  ];

  for (const [method, route] of lifecycleOperations) {
    assert.ok(swaggerSpec.paths[route]?.[method], `Missing ${method.toUpperCase()} ${route}`);
  }
});

test('notification center operations are documented', () => {
  const notificationOperations = [
    ['get', '/api/v1/notifications'],
    ['post', '/api/v1/notifications/read-all'],
    ['put', '/api/v1/notifications/{id}/read'],
  ];

  for (const [method, route] of notificationOperations) {
    assert.ok(swaggerSpec.paths[route]?.[method], `Missing ${method.toUpperCase()} ${route}`);
  }
});

test('learning and payment APIs are no longer exposed', () => {
  const removedPrefixes = [
    '/api/v1/payments',
    '/api/v1/invoices',
    '/api/v1/enrollments',
    '/api/v1/certificates',
    '/api/v1/quizzes',
    '/api/v1/lessons',
    '/api/v1/sub-courses',
    '/api/v1/student/dashboard',
    '/api/v1/teacher/dashboard',
  ];

  for (const route of Object.keys(swaggerSpec.paths)) {
    assert.equal(removedPrefixes.some((prefix) => route.startsWith(prefix)), false, route);
  }
});

test('the committed OpenAPI document matches the generated routes', () => {
  assert.ok(fs.existsSync(SPEC_FILE_PATH), 'openapi.json is missing - run `npm run swagger`');
  const committedSpec = JSON.parse(fs.readFileSync(SPEC_FILE_PATH, 'utf8'));
  assert.equal(
    JSON.stringify(committedSpec),
    JSON.stringify(swaggerSpec),
    'openapi.json is stale - run `npm run swagger`'
  );
});
