import { Prisma } from '@prisma/client';

/** Published artworks as the author and collection pages show them, oldest manuscript first */
export const publishedArtworks = {
  where: { status: 'PUBLISHED' },
  orderBy: [{ yearStart: 'asc' }, { order: 'asc' }],
  select: {
    id: true,
    title: true,
    objectDate: true,
    medium: true,
    artists: true,
    imageUrl: true,
    imageSmallUrl: true,
    museum: true,
    sourceUrl: true,
    creditLine: true,
    license: true,
    collection: { select: { slug: true, titleAz: true, titleRu: true, titleEn: true } },
  },
} satisfies Prisma.Author$artworksArgs;
