const crypto = require('node:crypto');
const logger = require('../utils/logger');
const { prisma } = require('../config/prisma');
const { sendSupportNotification, sendSupportReplyNotification } = require('../services/emailService');
const { getPageOptions, setPaginationHeaders } = require('../utils/pagination');

const SUPPORT_CHANNEL = 'support';
const LEGACY_CHANNELS = ['admin', 'moderator'];
const validGuestToken = /^[a-f0-9]{64}$/;
const conversationInclude = {
  owner: { select: { id: true, name: true, email: true } },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 100,
  },
};

const serializeConversation = (conversation) => ({
  ...conversation,
  messages: [...conversation.messages].reverse(),
});

const createGuestAccess = (_req, res) => res.status(201).json({
  success: true,
  accessToken: crypto.randomBytes(32).toString('hex'),
});

const getIdentity = (req, res) => {
  const channel = req.params.channel || SUPPORT_CHANNEL;
  if (req.user) {
    if (['admin', 'moderator'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Staff accounts should use the shared support inbox.' });
      return null;
    }

    return {
      where: { userId_channel: { userId: req.user.id, channel } },
      create: { userId: req.user.id, channel },
      legacyWhere: { userId: req.user.id },
      senderType: 'user',
      senderName: req.user.name || req.user.email,
      email: req.user.email,
    };
  }

  const token = req.get('X-Guest-Access-Token');
  if (!token || !validGuestToken.test(token)) {
    res.status(401).json({ success: false, message: 'Start a guest chat to continue.' });
    return null;
  }

  const guestIdentityHash = crypto.createHash('sha256').update(token).digest('hex');
  return {
    where: { guestIdentityHash_channel: { guestIdentityHash, channel } },
    create: {
      guestIdentityHash,
      channel,
      guestName: req.body?.name,
      guestEmail: req.body?.email,
    },
    legacyWhere: { guestIdentityHash },
    senderType: 'guest',
    senderName: req.body?.name,
    email: req.body?.email,
  };
};

const findConversation = async (identity) => {
  const conversation = await prisma.supportConversation.findUnique({
    where: identity.where,
    include: conversationInclude,
  });
  if (conversation) return conversation;

  return prisma.supportConversation.findFirst({
    where: { ...identity.legacyWhere, channel: { in: LEGACY_CHANNELS } },
    orderBy: { updatedAt: 'desc' },
    include: conversationInclude,
  });
};

const getConversation = async (req, res, next) => {
  try {
    const identity = getIdentity(req, res);
    if (!identity) return;

    const conversation = await findConversation(identity);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'No conversation exists in this channel yet.' });
    }

    return res.json({ success: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    return next(error);
  }
};

const startConversation = async (req, res, next) => {
  try {
    const identity = getIdentity(req, res);
    if (!identity) return;
    if (identity.senderType === 'guest' && (!req.body.name || !req.body.email)) {
      return res.status(400).json({ success: false, message: 'Name and email are required to start a guest chat.' });
    }

    const conversation = await prisma.supportConversation.upsert({
      where: identity.where,
      create: identity.create,
      update: identity.senderType === 'guest'
        ? { guestName: req.body.name, guestEmail: req.body.email }
        : {},
      include: conversationInclude,
    });

    return res.status(201).json({ success: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    return next(error);
  }
};

const updateNotificationStatus = async (messageId, conversationId, sendNotification) => {
  try {
    await sendNotification();
  } catch (error) {
    logger.error('Support message email notification failed', { message: error.message, messageId, conversationId });
    try {
      await prisma.supportMessage.update({
        where: { id: messageId },
        data: { notificationFailed: true },
      });
    } catch (updateError) {
      logger.error('Support message notification status could not be saved', {
        message: updateError.message,
        messageId,
        conversationId,
      });
    }

    return { emailSent: false, notificationSentAt: null, notificationFailed: true };
  }

  const sentAt = new Date();
  try {
    await prisma.supportMessage.update({
      where: { id: messageId },
      data: { notificationSentAt: sentAt, notificationFailed: false },
    });
  } catch (error) {
    logger.error('Support message notification status could not be saved', {
      message: error.message,
      messageId,
      conversationId,
    });
  }

  return { emailSent: true, notificationSentAt: sentAt, notificationFailed: false };
};

const sendUserMessage = async (req, res, next) => {
  try {
    const identity = getIdentity(req, res);
    if (!identity) return;

    const conversation = await findConversation(identity);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Start this channel before sending a message.' });
    }

    const message = await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: req.user?.id || null,
        senderType: identity.senderType,
        senderName: identity.senderType === 'guest' ? conversation.guestName : identity.senderName,
        body: req.body.message,
      },
    });
    await prisma.supportConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const displayName = identity.senderType === 'guest' ? conversation.guestName : identity.senderName;
    const email = identity.senderType === 'guest' ? conversation.guestEmail : identity.email;
    const notification = await updateNotificationStatus(
      message.id,
      conversation.id,
      () => sendSupportNotification({
        channel: conversation.channel,
        name: displayName,
        email,
        message: message.body,
      })
    );

    return res.status(201).json({
      success: true,
      emailSent: notification.emailSent,
      message: { ...message, ...notification },
    });
  } catch (error) {
    return next(error);
  }
};

const assertStaffChannel = (req, res) => {
  if (req.user.role === 'moderator' && !['support', 'moderator'].includes(req.params.channel)) {
    res.status(403).json({ success: false, message: 'Moderators can only access the support and moderator channels.' });
    return false;
  }
  return true;
};

const listConversations = async (req, res, next) => {
  try {
    if (!assertStaffChannel(req, res)) return;
    const pageOptions = getPageOptions(req.query);
    const accessibleChannels = req.params.channel === SUPPORT_CHANNEL
      ? req.user.role === 'admin'
        ? [SUPPORT_CHANNEL, ...LEGACY_CHANNELS]
        : [SUPPORT_CHANNEL, 'moderator']
      : [req.params.channel];
    const where = { channel: { in: accessibleChannels } };
    const [conversations, total] = await Promise.all([
      prisma.supportConversation.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        skip: pageOptions.skip,
        take: pageOptions.limit,
      }),
      prisma.supportConversation.count({ where }),
    ]);

    setPaginationHeaders(res, pageOptions, total);
    return res.json(conversations);
  } catch (error) {
    return next(error);
  }
};

const findStaffConversation = (req) => prisma.supportConversation.findFirst({
  where: {
    id: Number(req.params.conversationId),
    channel: req.params.channel,
  },
  include: conversationInclude,
});

const getStaffMessages = async (req, res, next) => {
  try {
    if (!assertStaffChannel(req, res)) return;
    const conversation = await findStaffConversation(req);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    return res.json({ success: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    return next(error);
  }
};

const sendStaffReply = async (req, res, next) => {
  try {
    if (!assertStaffChannel(req, res)) return;
    const conversation = await prisma.supportConversation.findFirst({
      where: {
        id: Number(req.params.conversationId),
        channel: req.params.channel,
      },
      include: { owner: { select: { email: true } } },
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const message = await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: req.user.id,
        senderType: 'staff',
        senderName: req.user.name || req.user.email,
        body: req.body.message,
      },
    });
    await prisma.supportConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const recipient = conversation.guestEmail || conversation.owner?.email;
    const notification = recipient
      ? await updateNotificationStatus(
        message.id,
        conversation.id,
        () => sendSupportReplyNotification({
          to: recipient,
          name: message.senderName,
          channel: conversation.channel,
          message: message.body,
        })
      )
      : { emailSent: false, notificationSentAt: null, notificationFailed: true };

    return res.status(201).json({
      success: true,
      emailSent: notification.emailSent,
      message: { ...message, ...notification },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createGuestAccess,
  getConversation,
  startConversation,
  sendUserMessage,
  listConversations,
  getStaffMessages,
  sendStaffReply,
};
