const { prisma } = require('../config/prisma');

const controller = {};

controller.getPublishedTeamMembers = async (_req, res) => {
  try {
    const members = await prisma.teamMember.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return res.json(members);
  } catch (error) {
    console.error('Public team member request failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.getAdminTeamMembers = async (_req, res) => {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return res.json(members);
  } catch (error) {
    console.error('Admin team member request failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.createTeamMember = async (req, res) => {
  try {
    const member = await prisma.teamMember.create({
      data: {
        name: req.body.name,
        title: req.body.title,
        bio: req.body.bio || null,
        photoUrl: req.body.photoUrl || null,
        displayOrder: req.body.displayOrder ?? 0,
        isPublished: req.body.isPublished ?? false,
      },
    });
    return res.status(201).json({ message: 'Team member created successfully', member });
  } catch (error) {
    console.error('Team member creation failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.updateTeamMember = async (req, res) => {
  try {
    const member = await prisma.teamMember.update({
      where: { id: Number(req.params.id) },
      data: {
        name: req.body.name,
        title: req.body.title,
        bio: req.body.bio === '' ? null : req.body.bio,
        photoUrl: req.body.photoUrl === '' ? null : req.body.photoUrl,
        displayOrder: req.body.displayOrder,
        isPublished: req.body.isPublished,
      },
    });
    return res.json({ message: 'Team member updated successfully', member });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    console.error('Team member update failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

controller.deleteTeamMember = async (req, res) => {
  try {
    await prisma.teamMember.delete({ where: { id: Number(req.params.id) } });
    return res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    console.error('Team member deletion failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = controller;
