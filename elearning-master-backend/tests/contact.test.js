const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const logger = require('../utils/logger');
const { prisma } = require('../config/prisma');

test('contact endpoint validates and delivers the frontend contact payload', async (t) => {
  const envKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'CONTACT_TO', 'JWT_SECRET', 'EMAIL_BRAND_NAME'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.test.local',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'test-password',
    SMTP_FROM: 'Website <sender@example.com>',
    CONTACT_TO: 'contact@example.com',
    JWT_SECRET: 'test-jwt-secret',
    EMAIL_BRAND_NAME: 'UtkriX Technologies',
  });

  const originalCreateTransport = nodemailer.createTransport;
  const originalLoggerError = logger.error;
  const contactMessageModel = prisma.contactMessage;
  const userModel = prisma.user;
  const originalContactMethods = {
    create: contactMessageModel.create,
    update: contactMessageModel.update,
    findMany: contactMessageModel.findMany,
    count: contactMessageModel.count,
  };
  const originalFindUnique = userModel.findUnique;
  const sentMessages = [];
  const transportOptions = [];
  const storedMessages = [];
  let shouldFailDelivery = false;
  logger.error = () => {};
  contactMessageModel.create = async ({ data }) => {
    const saved = { id: storedMessages.length + 1, ...data, createdAt: new Date(), emailSentAt: null, emailDeliveryFailed: false };
    storedMessages.unshift(saved);
    return { id: saved.id };
  };
  contactMessageModel.update = async ({ where, data }) => {
    const saved = storedMessages.find((item) => item.id === where.id);
    Object.assign(saved, data);
    return saved;
  };
  contactMessageModel.findMany = async () => storedMessages;
  contactMessageModel.count = async () => storedMessages.length;
  nodemailer.createTransport = (options) => {
    transportOptions.push(options);
    return {
      sendMail: async (mail) => {
        if (shouldFailDelivery) {
          throw new Error('SMTP unavailable');
        }
        sentMessages.push(mail);
      },
    };
  };

  const app = express();
  app.use(express.json());
  app.use('/api/v1/contact', require('../routes/contactRoutes'));
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/contact`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    nodemailer.createTransport = originalCreateTransport;
    logger.error = originalLoggerError;
    Object.assign(contactMessageModel, originalContactMethods);
    userModel.findUnique = originalFindUnique;
    envKeys.forEach((key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  });

  const validPayload = {
    name: 'Site visitor',
    email: 'visitor@example.com',
    phone: '+977 12345678',
    subject: 'Project inquiry',
    message: 'Please contact me about a project.',
    website: '',
  };

  const successResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(successResponse.status, 201);
  const successPayload = await successResponse.json();
  assert.equal(successPayload.success, true);
  assert.equal(successPayload.emailSent, true);
  assert.equal(sentMessages.length, 1);
  assert.deepEqual(transportOptions[0], {
    host: 'smtp.test.local',
    port: 587,
    secure: false,
    auth: { user: 'sender@example.com', pass: 'test-password' },
  });
  assert.equal(storedMessages.length, 1);
  assert.equal(storedMessages[0].name, validPayload.name);
  assert.ok(storedMessages[0].emailSentAt);
  assert.equal(sentMessages[0].from, process.env.SMTP_FROM);
  assert.equal(sentMessages[0].subject, 'New contact form message');
  assert.deepEqual(sentMessages[0].replyTo, { name: validPayload.name, address: validPayload.email });
  assert.match(sentMessages[0].text, /Phone: \+977 12345678/);
  assert.match(sentMessages[0].text, /Subject: Project inquiry/);
  assert.match(sentMessages[0].html, /UtkriX Technologies/);
  assert.match(sentMessages[0].html, /New website inquiry/);

  const invalidResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validPayload, phone: '12' }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).success, false);
  assert.equal(sentMessages.length, 1);
  assert.equal(storedMessages.length, 1);

  shouldFailDelivery = true;
  const deliveryFailureResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(deliveryFailureResponse.status, 201);
  const deliveryFailurePayload = await deliveryFailureResponse.json();
  assert.equal(deliveryFailurePayload.success, true);
  assert.equal(deliveryFailurePayload.emailSent, false);
  assert.equal(storedMessages.length, 2);
  assert.equal(storedMessages[0].emailDeliveryFailed, true);

  const unauthorizedResponse = await fetch(`${baseUrl}/admin`);
  assert.equal(unauthorizedResponse.status, 401);

  userModel.findUnique = async () => ({
    id: 8,
    email: 'moderator@example.com',
    role: 'moderator',
    tier: 'free',
    emailVerified: true,
    isApproved: true,
    tokenVersion: 0,
    isActive: true,
  });
  const moderatorToken = jwt.sign({
    id: 8,
    email: 'moderator@example.com',
    role: 'moderator',
    tier: 'free',
    tokenVersion: 0,
  }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const moderatorResponse = await fetch(`${baseUrl}/admin`, {
    headers: { Authorization: `Bearer ${moderatorToken}` },
  });
  assert.equal(moderatorResponse.status, 200);
  assert.equal(moderatorResponse.headers.get('X-Total-Count'), '2');
  assert.equal((await moderatorResponse.json()).length, 2);
});
