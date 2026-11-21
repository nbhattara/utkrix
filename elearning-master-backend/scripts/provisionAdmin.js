require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');

const envPath = path.join(__dirname, '..', '.env');
const envContents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const parsedEnv = require('dotenv').parse(envContents);
const email = (process.env.ADMIN_EMAIL || parsedEnv.ADMIN_EMAIL || '').trim();

if (!email) {
  throw new Error('Set ADMIN_EMAIL in elearning-master-backend/.env before provisioning.');
}

const writeAdminEnv = (password) => {
  const updatedLines = envContents
    .split(/\r?\n/)
    .filter((line) => !/^\s*ADMIN_(EMAIL|PASSWORD)\s*=/.test(line));
  updatedLines.push(`ADMIN_EMAIL=${email}`, `ADMIN_PASSWORD=${password}`);
  fs.writeFileSync(envPath, `${updatedLines.filter(Boolean).join('\n')}\n`, { mode: 0o600 });
};

const existingPassword = process.env.ADMIN_PASSWORD || parsedEnv.ADMIN_PASSWORD;
const generatedPassword = !existingPassword;
const password = existingPassword || crypto.randomBytes(24).toString('base64url');

if (password.length < 20) {
  throw new Error('ADMIN_PASSWORD must be at least 20 characters.');
}

if (generatedPassword || !parsedEnv.ADMIN_EMAIL || !parsedEnv.ADMIN_PASSWORD) {
  writeAdminEnv(password);
}

async function provisionAdmin() {
  const hashedPassword = await bcrypt.hash(password, 12);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  const account = await prisma.user.upsert({
    where: { email },
    create: {
      name: 'UtkriX Admin',
      email,
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
      isActive: true,
      isApproved: true,
      approvedAt: new Date(),
    },
    update: {
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
      isActive: true,
      isApproved: true,
      approvedAt: existingUser?.approvedAt || new Date(),
      tokenVersion: { increment: 1 },
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Admin account provisioned: ${account.email} (${account.role}).`);
  if (generatedPassword) {
    console.log(`Generated password: ${password}`);
  } else {
    console.log('The existing ADMIN_PASSWORD was retained from the backend .env.');
  }
}

provisionAdmin()
  .catch((error) => {
    console.error('Admin provisioning failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
