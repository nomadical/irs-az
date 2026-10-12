import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // Create admin user. The password comes from SEED_ADMIN_PASSWORD, or is generated and
  // printed once; it's only set when the user is created, never on re-seed.
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(18).toString('base64url');
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@irs.az' } });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@irs.az' },
    update: {},
    create: {
      email: 'admin@irs.az',
      username: 'admin',
      name: 'Admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'SUPERADMIN',
      isVerified: true,
    },
  });

  if (!existingAdmin) {
    console.log('Created admin user:', admin.email);
    if (generated) console.log('Admin password (shown once, store it safely):', adminPassword);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
