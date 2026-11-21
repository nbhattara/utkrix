const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const logger = require('../utils/logger');
const { prisma } = require('../config/prisma');

test('guest support chats persist by channel, notify staff, and accept role-scoped replies', async (t) => {
  const envKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'CONTACT_TO', 'JWT_SECRET'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  envKeys.forEach((key, index) => {
    process.env[key] = [
      'smtp.test.local',
      '587',
      'sender@example.com',
      'test-password',
      'Website <sender@example.com>',
      'contact@example.com',
      'support-test-jwt-secret',
    ][index];
  });

  const conversationModel = prisma.supportConversation;
  const messageModel = prisma.supportMessage;
  const userModel = prisma.user;
  const originalConversationMethods = {
    upsert: conversationModel.upsert,
    findUnique: conversationModel.findUnique,
    findFirst: conversationModel.findFirst,
    findMany: conversationModel.findMany,
    count: conversationModel.count,
    update: conversationModel.update,
  };
  const originalMessageMethods = {
    create: messageModel.create,
    update: messageModel.update,
  };
  const originalFindUnique = userModel.findUnique;
  const originalCreateTransport = nodemailer.createTransport;
  const originalLoggerError = logger.error;
  const conversations = [];
  const users = new Map([
    [7, { id: 7, name: 'Test Moderator', email: 'moderator@example.com', role: 'moderator' }],
    [8, { id: 8, name: 'Test Administrator', email: 'admin@example.com', role: 'admin' }],
  ]);
  const deliveredEmails = [];
  let shouldFailEmail = false;
  let nextMessageId = 1;
  const findOwnedConversation = (where) => {
    if (where.userId_channel) {
      return conversations.find((item) => item.userId === where.userId_channel.userId && item.channel === where.userId_channel.channel);
    }
    if (where.guestIdentityHash_channel) {
      return conversations.find((item) => item.guestIdentityHash === where.guestIdentityHash_channel.guestIdentityHash && item.channel === where.guestIdentityHash_channel.channel);
    }
    return undefined;
  };

  logger.error = () => {};
  conversationModel.upsert = async ({ where, create, update }) => {
    const existing = findOwnedConversation(where);
    if (existing) {
      Object.assign(existing, update);
      return existing;
    }
    const created = {
      id: conversations.length + 1,
      ...create,
      owner: null,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    conversations.push(created);
    return created;
  };
  conversationModel.findUnique = async ({ where }) => findOwnedConversation(where) || null;
  conversationModel.findFirst = async ({ where }) => conversations.find((item) => item.id === where.id && item.channel === where.channel) || null;
  conversationModel.findMany = async ({ where }) => {
    const channels = where.channel.in || [where.channel];
    return conversations.filter((item) => channels.includes(item.channel));
  };
  conversationModel.count = async ({ where }) => {
    const channels = where.channel.in || [where.channel];
    return conversations.filter((item) => channels.includes(item.channel)).length;
  };
  conversationModel.update = async ({ where, data }) => {
    const conversation = conversations.find((item) => item.id === where.id);
    Object.assign(conversation, data);
    return conversation;
  };
  messageModel.create = async ({ data }) => {
    const message = {
      id: nextMessageId++,
      ...data,
      createdAt: new Date(),
      notificationSentAt: null,
      notificationFailed: false,
    };
    conversations.find((item) => item.id === data.conversationId).messages.push(message);
    return message;
  };
  messageModel.update = async ({ where, data }) => {
    const message = conversations.flatMap((item) => item.messages).find((item) => item.id === where.id);
    Object.assign(message, data);
    return message;
  };
  userModel.findUnique = async ({ where }) => {
    const user = users.get(where.id);
    return user ? {
      ...user,
      tier: 'free',
      emailVerified: true,
      isApproved: true,
      tokenVersion: 0,
      isActive: true,
    } : null;
  };
  nodemailer.createTransport = () => ({
    sendMail: async (mail) => {
      if (shouldFailEmail) throw new Error('SMTP unavailable');
      deliveredEmails.push(mail);
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/support', require('../routes/supportRoutes'));
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/support`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Object.assign(conversationModel, originalConversationMethods);
    Object.assign(messageModel, originalMessageMethods);
    userModel.findUnique = originalFindUnique;
    nodemailer.createTransport = originalCreateTransport;
    logger.error = originalLoggerError;
    envKeys.forEach((key) => {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    });
  });

  const guestResponse = await fetch(`${baseUrl}/guest-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Site visitor', email: 'visitor@example.com' }),
  });
  assert.equal(guestResponse.status, 201);
  const guestAccessToken = (await guestResponse.json()).accessToken;
  assert.match(guestAccessToken, /^[a-f0-9]{64}$/);

  const guestHeaders = {
    'Content-Type': 'application/json',
    'X-Guest-Access-Token': guestAccessToken,
  };
  const missingConversationResponse = await fetch(`${baseUrl}/conversations/admin`, {
    headers: { 'X-Guest-Access-Token': guestAccessToken },
  });
  assert.equal(missingConversationResponse.status, 404, 'GET without a JSON body must report a missing thread, not a server error');

  const createAdminConversation = () => fetch(`${baseUrl}/conversations/admin`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ name: 'Site visitor', email: 'visitor@example.com' }),
  });
  const firstConversationResponse = await createAdminConversation();
  assert.equal(firstConversationResponse.status, 201);
  const firstConversation = (await firstConversationResponse.json()).conversation;
  assert.equal((await createAdminConversation()).status, 201);
  assert.equal(conversations.length, 1, 'a guest can have only one conversation in each channel');
  const resumedConversationResponse = await fetch(`${baseUrl}/conversations/admin`, {
    headers: { 'X-Guest-Access-Token': guestAccessToken },
  });
  assert.equal(resumedConversationResponse.status, 200);
  assert.equal((await resumedConversationResponse.json()).conversation.id, firstConversation.id);

  const firstMessageResponse = await fetch(`${baseUrl}/conversations/admin/messages`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ message: 'Hello the admin team.' }),
  });
  assert.equal(firstMessageResponse.status, 201);
  const firstMessage = await firstMessageResponse.json();
  assert.equal(firstMessage.emailSent, true);
  assert.equal(conversations[0].messages.length, 1);
  assert.equal(deliveredEmails[0].to, 'contact@example.com');

  const moderatorConversationResponse = await fetch(`${baseUrl}/conversations/moderator`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ name: 'Site visitor', email: 'visitor@example.com' }),
  });
  assert.equal(moderatorConversationResponse.status, 201);
  assert.equal(conversations.length, 2, 'the second channel has a separate thread');

  const supportConversationResponse = await fetch(`${baseUrl}/conversations/support`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ name: 'Site visitor', email: 'visitor@example.com' }),
  });
  assert.equal(supportConversationResponse.status, 201);
  const supportConversation = (await supportConversationResponse.json()).conversation;
  const supportMessageResponse = await fetch(`${baseUrl}/conversations/support/messages`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ message: 'Hello the support team.' }),
  });
  assert.equal(supportMessageResponse.status, 201);
  assert.equal(conversations[2].messages.length, 1);

  shouldFailEmail = true;
  const unsentNotificationResponse = await fetch(`${baseUrl}/conversations/moderator/messages`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ message: 'This message still persists if SMTP is down.' }),
  });
  assert.equal(unsentNotificationResponse.status, 201);
  const unsentNotification = await unsentNotificationResponse.json();
  assert.equal(unsentNotification.success, true);
  assert.equal(unsentNotification.emailSent, false);
  assert.equal(conversations[1].messages.length, 1);
  assert.equal(conversations[1].messages[0].notificationFailed, true);
  shouldFailEmail = false;

  const moderatorToken = jwt.sign({
    id: 7,
    email: 'moderator@example.com',
    role: 'moderator',
    tier: 'free',
    tokenVersion: 0,
  }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const forbiddenResponse = await fetch(`${baseUrl}/inbox/admin`, {
    headers: { Authorization: `Bearer ${moderatorToken}` },
  });
  assert.equal(forbiddenResponse.status, 403);

  const moderatorInboxResponse = await fetch(`${baseUrl}/inbox/moderator`, {
    headers: { Authorization: `Bearer ${moderatorToken}` },
  });
  assert.equal(moderatorInboxResponse.status, 200);
  assert.equal((await moderatorInboxResponse.json()).length, 1);

  const moderatorSupportInboxResponse = await fetch(`${baseUrl}/inbox/support`, {
    headers: { Authorization: 'Bearer ' + moderatorToken },
  });
  assert.equal(moderatorSupportInboxResponse.status, 200);
  assert.equal((await moderatorSupportInboxResponse.json()).length, 2);

  const moderatorSupportMessagesResponse = await fetch(
    `${baseUrl}/inbox/support/${supportConversation.id}/messages`,
    { headers: { Authorization: 'Bearer ' + moderatorToken } }
  );
  assert.equal(moderatorSupportMessagesResponse.status, 200);
  assert.equal((await moderatorSupportMessagesResponse.json()).conversation.id, supportConversation.id);
  const moderatorSupportReplyResponse = await fetch(
    `${baseUrl}/inbox/support/${supportConversation.id}/messages`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + moderatorToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'We can help with that.' }),
    }
  );
  assert.equal(moderatorSupportReplyResponse.status, 201);

  const adminToken = jwt.sign({
    id: 8,
    email: 'admin@example.com',
    role: 'admin',
    tier: 'free',
    tokenVersion: 0,
  }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const replyResponse = await fetch(`${baseUrl}/inbox/admin/${firstConversation.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Thanks for your message.' }),
  });
  assert.equal(replyResponse.status, 201);
  const reply = await replyResponse.json();
  assert.equal(reply.emailSent, true);
  assert.equal(deliveredEmails.at(-1).to, 'visitor@example.com');
  assert.equal(conversations[0].messages.length, 2);

  const mismatchedChannelResponse = await fetch(
    `${baseUrl}/inbox/admin/${supportConversation.id}/messages`,
    { headers: { Authorization: 'Bearer ' + adminToken } }
  );
  assert.equal(mismatchedChannelResponse.status, 404);
});
