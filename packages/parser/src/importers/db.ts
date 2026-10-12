import { PrismaClient, PublishStatus } from '@prisma/client';

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

/** Status for a new row: --publish publishes it, otherwise the file decides. A held row stays a draft. */
export function newStatus(opts: { publish?: boolean }, fileStatus?: PublishStatus, hold?: string): PublishStatus {
  if (hold) return 'DRAFT';
  return opts.publish ? 'PUBLISHED' : (fileStatus ?? 'DRAFT');
}

/**
 * Status change for an existing row. Without --publish it keeps the status it has, so a plain
 * re-import doesn't unpublish what an editor or an earlier --publish import published.
 */
export function statusUpdate(opts: { publish?: boolean }, hold?: string): { status?: PublishStatus } {
  if (hold) return { status: 'DRAFT' };
  return opts.publish ? { status: 'PUBLISHED' } : {};
}

export async function disconnectDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
