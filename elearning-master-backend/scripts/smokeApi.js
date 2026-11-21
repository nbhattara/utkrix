require('dotenv').config();

const path = require('node:path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');
const swaggerSpec = require('../config/swagger');

const root = path.join(__dirname, '..');
process.chdir(root);

const baseUrl = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const missingId = '2147483000';
function valueForParameter(parameter) {
  if (parameter.in === 'path') {
    return missingId;
  }
  if (parameter.in !== 'query') return undefined;
  if (parameter.name === 'page') return '1';
  if (parameter.name === 'limit') return '1';
  if (parameter.name === 'status') return 'pending';
  if (parameter.name === 'role') return 'student';
  if (parameter.schema?.type === 'boolean') return 'true';
  return 'smoke-test';
}

function resolvePath(template, operation) {
  let route = template.replace(/\{([^}]+)\}/g, (_match, name) => {
    const parameter = operation.parameters?.find((item) => item.in === 'path' && item.name === name);
    return encodeURIComponent(valueForParameter(parameter || { in: 'path', name }));
  });
  const query = new URLSearchParams();
  for (const parameter of operation.parameters || []) {
    if (parameter.in !== 'query') continue;
    const value = valueForParameter(parameter);
    if (value !== undefined) query.set(parameter.name, value);
  }
  if ([...query].length) route += `?${query}`;
  return route;
}

async function request(method, route, options = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, payload };
}

function assertStatus(ok, operationName, status, expected) {
  if (!ok) throw new Error(`${operationName}: received HTTP ${status}; expected ${expected}`);
}

async function smokeOpenApiOperations() {
  const failures = [];
  let total = 0;

  for (const [routeTemplate, pathItem] of Object.entries(swaggerSpec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      total += 1;
      const operationName = `${method.toUpperCase()} ${routeTemplate}`;
      const isPublic = operation.security?.length === 0
        || (!operation.security && !swaggerSpec.security?.length);
      const route = routeTemplate.startsWith('/api/v1')
        ? `/api/v1${resolvePath(routeTemplate.replace(/^\/api\/v1/, ''), operation)}`
        : resolvePath(routeTemplate, operation);
      try {
        const response = await request(method.toUpperCase(), route, {
          body: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? {} : undefined,
        });
        if (!isPublic) {
          assertStatus(response.status === 401, operationName, response.status, 401);
        } else if (method === 'get' && routeTemplate === '/api/v1/courses') {
          assertStatus(response.status === 200, operationName, response.status, 200);
        } else if (method === 'get') {
          assertStatus(
            [200, 202, 302, 303, 400, 404, 429].includes(response.status),
            operationName,
            response.status,
            'a safe public response'
          );
        } else {
          assertStatus([400, 404, 422, 429].includes(response.status), operationName, response.status, 'validation or rate-limit response');
        }
        console.log(`PASS ${operationName} -> ${response.status}`);
      } catch (error) {
        failures.push(`${operationName}: ${error.message}`);
        console.error(`FAIL ${operationName}: ${error.message}`);
      }
    }
  }

  console.log(`OpenAPI route smoke: ${total - failures.length}/${total} passed`);
  return failures;
}

async function createRoleTokens() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required to test authenticated dashboard APIs.');
  const users = await prisma.user.findMany({
    where: { role: { in: ['student', 'instructor', 'admin'] }, isActive: true, emailVerified: true },
    select: {
      id: true,
      email: true,
      role: true,
      tier: true,
      tokenVersion: true,
      isApproved: true,
    },
    orderBy: { id: 'asc' },
  });
  const eligibleUsers = users.filter((user) => user.role !== 'instructor' || user.isApproved);
  const tokens = {};
  for (const role of ['student', 'instructor', 'admin']) {
    const user = eligibleUsers.find((item) => item.role === role);
    if (user) {
      tokens[role] = {
        user,
        token: jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            tier: user.tier,
            tokenVersion: user.tokenVersion,
          },
          process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
          { expiresIn: '5m' }
        ),
      };
    }
  }
  return tokens;
}

async function smokeAuthenticatedScreens(tokens) {
  const checks = [
    ['instructor', 'GET', '/api/v1/courses/manage?page=1&limit=1', 200],
    ['admin', 'GET', '/api/v1/courses/manage?page=1&limit=1', 200],
    ['admin', 'GET', '/api/v1/projects/admin?page=1&limit=1', 200],
    ['admin', 'GET', '/api/v1/admin/dashboard', 200],
    ['admin', 'GET', '/api/v1/admin/users', 200],
    ['admin', 'GET', '/api/v1/admin/pending-teachers', 200],
  ];
  const failures = [];

  for (const [role, method, route, expectedStatus] of checks) {
    if (!tokens[role]) {
      console.log(`SKIP ${role} screen checks: no active, verified ${role} user exists`);
      continue;
    }
    const label = `${role.toUpperCase()} ${method} ${route}`;
    try {
      const response = await request(method, route, { token: tokens[role].token });
      assertStatus(response.status === expectedStatus, label, response.status, expectedStatus);
      console.log(`PASS ${label} -> ${response.status}`);
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
      console.error(`FAIL ${label}: ${error.message}`);
    }
  }
  return failures;
}

(async () => {
  const failures = await smokeOpenApiOperations();
  const tokens = await createRoleTokens();
  failures.push(...await smokeAuthenticatedScreens(tokens));
  if (failures.length) {
    console.error(`API smoke failed: ${failures.length} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('All safe API smoke checks passed.');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
