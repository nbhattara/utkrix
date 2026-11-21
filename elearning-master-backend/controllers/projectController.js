const { prisma } = require('../config/prisma');
const { getPageOptions, setPaginationHeaders } = require('../utils/pagination');

const controller = {};

const getProjectFilters = ({ category, search }) => {
  const where = {};

  if (category) where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } },
    ];
  }

  return where;
};

const listProjects = async (req, res, where) => {
  const pageOptions = getPageOptions(req.query);
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: pageOptions.skip,
      take: pageOptions.limit,
    }),
    prisma.project.count({ where }),
  ]);

  setPaginationHeaders(res, pageOptions, total);
  return res.json(projects);
};

const findProjectById = async (id, publishedOnly) => prisma.project.findFirst({
  where: {
    id,
    ...(publishedOnly ? { isPublished: true } : {}),
  },
});

const sendServerError = (res, error) => {
  console.error('Project request failed:', error);
  return res.status(500).json({
    success: false,
    message: 'Server error',
  });
};

controller.getPublishedProjects = async (req, res) => {
  try {
    return await listProjects(req, res, {
      ...getProjectFilters(req.query),
      isPublished: true,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

controller.getAdminProjects = async (req, res) => {
  try {
    const where = getProjectFilters(req.query);
    if (req.query.isPublished !== undefined) {
      where.isPublished = req.query.isPublished === 'true';
    }
    return await listProjects(req, res, where);
  } catch (error) {
    return sendServerError(res, error);
  }
};

controller.createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      imageUrl,
      projectUrl,
      tags,
      isFeatured,
      isPublished,
      sortOrder,
    } = req.body;

    const project = await prisma.project.create({
      data: {
        title,
        description,
        category,
        imageUrl: imageUrl || null,
        projectUrl: projectUrl || null,
        tags: tags || [],
        isFeatured: isFeatured === true || isFeatured === 'true',
        isPublished: isPublished === true || isPublished === 'true',
        sortOrder: sortOrder === undefined ? 0 : Number(sortOrder),
      },
    });

    return res.status(201).json({ message: 'Project created successfully', project });
  } catch (error) {
    return sendServerError(res, error);
  }
};

controller.updateProject = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await findProjectById(id, false);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const updateData = {};
    for (const field of ['title', 'description', 'category', 'imageUrl', 'projectUrl', 'tags', 'isFeatured', 'isPublished', 'sortOrder']) {
      if (req.body[field] !== undefined) {
        if (field === 'sortOrder') {
          updateData[field] = Number(req.body[field]);
        } else if (field === 'isFeatured' || field === 'isPublished') {
          updateData[field] = req.body[field] === true || req.body[field] === 'true';
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    return res.json({ message: 'Project updated successfully', project });
  } catch (error) {
    return sendServerError(res, error);
  }
};

controller.deleteProject = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await findProjectById(id, false);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await prisma.project.delete({ where: { id } });
    return res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    return sendServerError(res, error);
  }
};

module.exports = controller;
