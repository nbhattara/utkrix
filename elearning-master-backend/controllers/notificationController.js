const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');

const controller = {};

controller.list = async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
    ]);
    return res.json({ notifications, unreadCount });
  } catch (error) {
    return next(error);
  }
};

controller.markRead = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true, readAt: true },
    });
    if (!notification) throw new AppError('Notification not found.', 404);
    const updated = notification.readAt
      ? notification
      : await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
    return res.json({ notification: updated });
  } catch (error) {
    return next(error);
  }
};

controller.createBroadcast = async (req, res, next) => {
  try {
    const { title, body, imageUrl } = req.body;
    const recipients = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (!recipients.length) throw new AppError('There are no active accounts to notify.', 400);

    const result = await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        type: 'announcement',
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl || null,
      })),
    });

    return res.status(201).json({
      message: `Notification sent to ${result.count} account${result.count === 1 ? '' : 's'}.`,
      recipientCount: result.count,
    });
  } catch (error) {
    return next(error);
  }
};

controller.markAllRead = async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return res.json({ message: 'Notifications marked as read.', updatedCount: result.count });
  } catch (error) {
    return next(error);
  }
};

module.exports = controller;
