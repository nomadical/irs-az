import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/** Find a work by its current slug, import key, or a previous slug. */
export async function findWork(slug: string) {
  const db = getDb();
  return (
    (await db.work.findUnique({ where: { slug } })) ??
    (await db.work.findUnique({ where: { sourceId: slug } })) ??
    (await db.work.findFirst({ where: { previousSlugs: { has: slug } } }))
  );
}

export async function disconnectDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
