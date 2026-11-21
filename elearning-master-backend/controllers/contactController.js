const logger = require('../utils/logger');
const { prisma } = require('../config/prisma');
const { sendContactMessage } = require('../services/emailService');
const { getPageOptions, setPaginationHeaders } = require('../utils/pagination');

const submitContactMessage = async (req, res) => {
  const { name, email, phone, subject, message, website } = req.body;

  if (website) {
    return res.status(201).json({ success: true, message: 'Thanks for reaching out. Your message has been received.' });
  }

  let savedMessage;
  try {
    savedMessage = await prisma.contactMessage.create({
      data: { name, email, phone: phone || null, subject, message },
      select: { id: true },
    });
  } catch (error) {
    logger.error('Contact form message could not be saved', { message: error.message });
    return res.status(503).json({
      success: false,
      message: 'We could not save your message right now. Please try again later.',
    });
  }

  try {
    await sendContactMessage({ name, email, phone, subject, message });
  } catch (error) {
    logger.error('Contact form email delivery failed', { message: error.message, contactMessageId: savedMessage.id });
    try {
      await prisma.contactMessage.update({
        where: { id: savedMessage.id },
        data: { emailDeliveryFailed: true },
      });
    } catch (updateError) {
      logger.error('Contact message email status could not be saved', {
        message: updateError.message,
        contactMessageId: savedMessage.id,
      });
    }

    return res.status(201).json({
      success: true,
      emailSent: false,
      message: 'Your message is saved, but the email notification could not be sent. Our team can still see it in the dashboard.',
    });
  }

  try {
    await prisma.contactMessage.update({
      where: { id: savedMessage.id },
      data: { emailSentAt: new Date(), emailDeliveryFailed: false },
    });
  } catch (error) {
    logger.error('Contact message email status could not be saved', {
      message: error.message,
      contactMessageId: savedMessage.id,
    });
    return res.status(201).json({
      success: true,
      emailSent: true,
      message: 'Your message is saved and the email was sent, but its delivery status could not be recorded.',
    });
  }

  return res.status(201).json({
    success: true,
    emailSent: true,
    message: 'Thanks for reaching out. Your message has been saved and sent to our team.',
  });
};

const getContactMessages = async (req, res, next) => {
  try {
    const pageOptions = getPageOptions(req.query);
    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pageOptions.skip,
        take: pageOptions.limit,
      }),
      prisma.contactMessage.count(),
    ]);

    setPaginationHeaders(res, pageOptions, total);
    return res.json(messages);
  } catch (error) {
    return next(error);
  }
};

module.exports = { submitContactMessage, getContactMessages };
