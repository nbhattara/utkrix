const { prisma } = require('../config/prisma');

const controller = {};

controller.getPublishedFaqs = async (_req, res) => {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return res.json(faqs);
  } catch (error) {
    console.error('Public FAQ request failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.getAdminFaqs = async (_req, res) => {
  try {
    const faqs = await prisma.faq.findMany({
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return res.json(faqs);
  } catch (error) {
    console.error('Admin FAQ request failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.createFaq = async (req, res) => {
  try {
    const faq = await prisma.faq.create({
      data: {
        question: req.body.question,
        answer: req.body.answer,
        displayOrder: req.body.displayOrder ?? 0,
        isPublished: req.body.isPublished ?? false,
      },
    });
    return res.status(201).json({ message: 'FAQ created successfully', faq });
  } catch (error) {
    console.error('FAQ creation failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.updateFaq = async (req, res) => {
  try {
    const faq = await prisma.faq.update({
      where: { id: Number(req.params.id) },
      data: {
        question: req.body.question,
        answer: req.body.answer,
        displayOrder: req.body.displayOrder,
        isPublished: req.body.isPublished,
      },
    });
    return res.json({ message: 'FAQ updated successfully', faq });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    console.error('FAQ update failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.deleteFaq = async (req, res) => {
  try {
    await prisma.faq.delete({ where: { id: Number(req.params.id) } });
    return res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    console.error('FAQ deletion failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = controller;
