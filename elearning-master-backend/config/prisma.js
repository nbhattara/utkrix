const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('MySQL connected successfully');
    return true;
  } catch (error) {
    console.error('MySQL connection failed:');
    console.error(error.message);
    return false;
  }
};

module.exports = { prisma, connectDB };
