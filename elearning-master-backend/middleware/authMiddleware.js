const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  if (!decoded || !Number.isInteger(decoded.id)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tier: true,
        emailVerified: true,
        isApproved: true,
        tokenVersion: true,
        isActive: true,
      },
    });

    if (!user || (decoded.tokenVersion || 0) !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated',
      });
    }

    if (decoded.email !== user.email || decoded.role !== user.role || decoded.tier !== user.tier) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Verify your email before accessing protected routes',
      });
    }

    if (user.role === 'instructor' && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your instructor account is not yet approved by admin',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = protect;
