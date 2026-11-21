const { prisma } = require('../config/prisma');
const { sendInstructorApproval } = require('../services/emailService');

const controller = {};

controller.getAdminDashboard = async (_req, res) => {
  try {
    const [
      totalUsers,
      teachers,
      pendingTeachers,
      totalCourses,
      publishedCourses,
      totalProjects,
      publishedProjects,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'instructor' } }),
      prisma.user.count({ where: { role: 'instructor', isApproved: false } }),
      prisma.course.count(),
      prisma.course.count({ where: { isPublished: true } }),
      prisma.project.count(),
      prisma.project.count({ where: { isPublished: true } }),
    ]);

    return res.json({
      success: true,
      dashboard: {
        users: { total: totalUsers, teachers, pendingTeachers },
        courses: { total: totalCourses, published: publishedCourses },
        projects: { total: totalProjects, published: publishedProjects },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.getPendingTeachers = async (_req, res) => {
  try {
    const pendingTeachers = await prisma.user.findMany({
      where: { role: 'instructor', isApproved: false, isActive: true },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, pendingTeachers });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.approveTeacher = async (req, res) => {
  try {
    const teacherId = Number(req.params.teacherId);
    const teacher = await prisma.$transaction(async (tx) => {
      const updatedTeacher = await tx.user.update({
        where: { id: teacherId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          tokenVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user.id,
          action: 'instructor.approve',
          targetType: 'user',
          targetId: String(teacherId),
          result: 'success',
        },
      });
      return updatedTeacher;
    });

    await sendInstructorApproval(teacher);

    return res.json({
      success: true,
      message: 'Teacher approved successfully',
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        isApproved: teacher.isApproved,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.getAllUsers = async (req, res) => {
  try {
    const { role, isApproved, search } = req.query;
    const where = {};

    if (role) where.role = role;
    if (isApproved !== undefined) where.isApproved = isApproved === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tier: true,
        isApproved: true,
        approvedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { role, tier } = req.body;
    const updateData = {};

    if (role) updateData.role = role;
    if (tier) updateData.tier = tier;
    updateData.tokenVersion = { increment: 1 };

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tier: true,
          isApproved: true,
          approvedAt: true,
          isActive: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.user.id,
          action: 'user.update',
          targetType: 'user',
          targetId: String(userId),
          result: 'success',
          metadata: Object.keys(req.body),
        },
      });
      return updatedUser;
    });

    return res.json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

controller.deleteUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (target.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Administrator accounts cannot be deactivated here' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.user.id,
          action: 'user.deactivate',
          targetType: 'user',
          targetId: String(userId),
          result: 'success',
        },
      });
    });

    return res.json({
      success: true,
      message: 'User deactivated; existing records are retained',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = controller;
