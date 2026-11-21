const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const { getPageOptions, setPaginationHeaders } = require('../utils/pagination');

const controller = {};

controller.getAllCourses = async (req, res) => {
  try {
    const { category, search } = req.query;
    const pageOptions = getPageOptions(req.query);
    const where = { isPublished: true };

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          instructorId: true,
          thumbnail: true,
          price: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
          instructor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pageOptions.skip,
        take: pageOptions.limit,
      }),
      prisma.course.count({ where }),
    ]);

    setPaginationHeaders(res, pageOptions, total);
    res.json(courses);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.getCourseCategories = async (req, res) => {
  try {
    const categories = await prisma.course.findMany({
      where: { isPublished: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    res.json(categories.map(({ category }) => category));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.getManageCourses = async (req, res) => {
  try {
    const pageOptions = getPageOptions(req.query);
    const where = req.user.role === 'admin' ? {} : { instructorId: req.user.id };
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          instructor: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: pageOptions.skip,
        take: pageOptions.limit,
      }),
      prisma.course.count({ where }),
    ]);

    setPaginationHeaders(res, pageOptions, total);
    return res.json(courses);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.createCourse = async (req, res) => {
  try {
    const { title, description, category, price, is_published } = req.body;
    const thumbnail = req.file ? (req.file.url || `/uploads/${req.file.filename}`) : null;

    const create = (tx) => tx.course.create({
      data: {
        instructorId: req.user.id,
        title,
        description,
        category,
        thumbnail,
        price: price === undefined || price === '' ? 0 : Number(price),
        isPublished: is_published === true || is_published === 'true',
      },
    });

    const course = req.user.role === 'instructor' && req.user.tier === 'free'
      ? await prisma.$transaction(async (tx) => {
        const courseCount = await tx.course.count({
          where: { instructorId: req.user.id },
        });
        if (courseCount >= 2) {
          throw new AppError(
            'Free tier instructors can create maximum 2 courses. Upgrade to premium for unlimited access.',
            403
          );
        }
        return create(tx);
      }, { isolationLevel: 'Serializable' })
      : await create(prisma);

    res.status(201).json({
      message: 'Course created successfully',
      course,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Server error',
      ...(error.statusCode ? {} : { error: error.message }),
    });
  }
};

controller.updateCourse = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (course.instructorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course',
      });
    }

    const { title, description, category, price, is_published } = req.body;
    const updateData = {};

    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (price !== undefined) updateData.price = Number(price);
    if (is_published !== undefined) updateData.isPublished = is_published === true || is_published === 'true';
    if (req.file) updateData.thumbnail = req.file.url || `/uploads/${req.file.filename}`;

    const updatedCourse = await prisma.course.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
    });

    res.json({
      message: 'Course updated successfully',
      course: updatedCourse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.deleteCourse = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (course.instructorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course',
      });
    }

    await prisma.course.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({
      message: 'Course deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = controller;
