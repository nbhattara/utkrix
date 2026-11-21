const { prisma } = require('../config/prisma');

const dynamicSources = [
  'users',
  'students',
  'instructors',
  'courses',
  'publishedCourses',
  'projects',
  'publishedProjects',
  'teamMembers',
];

const countForSource = (source) => {
  switch (source) {
    case 'users':
      return prisma.user.count({ where: { isActive: true } });
    case 'students':
      return prisma.user.count({ where: { role: 'student', isActive: true } });
    case 'instructors':
      return prisma.user.count({ where: { role: 'instructor', isActive: true, isApproved: true } });
    case 'courses':
      return prisma.course.count();
    case 'publishedCourses':
      return prisma.course.count({ where: { isPublished: true } });
    case 'projects':
      return prisma.project.count();
    case 'publishedProjects':
      return prisma.project.count({ where: { isPublished: true } });
    case 'teamMembers':
      return prisma.teamMember.count({ where: { isPublished: true } });
    default:
      throw new Error(`Unsupported statistics source: ${source}`);
  }
};

const countsForMetrics = async (metrics) => {
  const sources = [...new Set(metrics
    .filter((metric) => metric.source !== 'manual')
    .map((metric) => metric.source))];
  return Object.fromEntries(await Promise.all(sources.map(async (source) => [
    source,
    await countForSource(source),
  ])));
};

const resolveValue = (metric, counts) => (metric.source === 'manual'
  ? metric.manualValue || ''
  : `${metric.prefix}${counts[metric.source].toLocaleString()}${metric.suffix}`);

const controller = {};

controller.getPublishedMetrics = async (_req, res) => {
  try {
    const metrics = await prisma.statsMetric.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    const counts = await countsForMetrics(metrics);

    return res.json(metrics
      .map((metric) => ({
        id: metric.id,
        label: metric.label,
        value: resolveValue(metric, counts),
        displayOrder: metric.displayOrder,
      }))
      .filter((metric) => metric.value !== ''));
  } catch (error) {
    console.error('Public statistics request failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.getAdminMetrics = async (_req, res) => {
  try {
    const metrics = await prisma.statsMetric.findMany({
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    const counts = await countsForMetrics(metrics);
    return res.json(metrics.map((metric) => ({
      ...metric,
      previewValue: resolveValue(metric, counts),
    })));
  } catch (error) {
    console.error('Admin statistics request failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.createMetric = async (req, res) => {
  try {
    const metric = await prisma.statsMetric.create({
      data: {
        label: req.body.label,
        source: req.body.source,
        manualValue: req.body.source === 'manual' ? req.body.manualValue || null : null,
        prefix: req.body.prefix || '',
        suffix: req.body.suffix || '',
        displayOrder: req.body.displayOrder ?? 0,
        isPublished: req.body.isPublished ?? false,
      },
    });
    return res.status(201).json({ message: 'Statistic created successfully', metric });
  } catch (error) {
    console.error('Statistic creation failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.updateMetric = async (req, res) => {
  try {
    const metric = await prisma.statsMetric.update({
      where: { id: Number(req.params.id) },
      data: {
        label: req.body.label,
        source: req.body.source,
        manualValue: req.body.source === 'manual' ? req.body.manualValue || null : null,
        prefix: req.body.prefix || '',
        suffix: req.body.suffix || '',
        displayOrder: req.body.displayOrder,
        isPublished: req.body.isPublished,
      },
    });
    return res.json({ message: 'Statistic updated successfully', metric });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Statistic not found' });
    }
    console.error('Statistic update failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.deleteMetric = async (req, res) => {
  try {
    await prisma.statsMetric.delete({ where: { id: Number(req.params.id) } });
    return res.json({ message: 'Statistic deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Statistic not found' });
    }
    console.error('Statistic deletion failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = controller;
