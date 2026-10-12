import { Command } from 'commander';
import { getDb, disconnectDb } from '../importers/db';
import { TAGS } from '../tagging/taxonomy';
import { tagsFor } from '../tagging/rules';

/**
 * Tag works by keyword and structural rules. Rule tags are replaced on every run;
 * tags an editor set (source EDITOR) are never touched.
 */
export const tagWorksCommand = new Command('tag-works')
  .description('Assign theme, mood, audience and era tags to works by keyword rules')
  .option('--author <slug>', 'Only tag works by this author')
  .option('--dry-run', 'Report the tag distribution without writing')
  .option('--samples <n>', 'With --dry-run, print n example titles per tag', '0')
  .option('--explain <slug>', 'Print the scores and matched words for one work, then exit')
  .action(async (opts: { author?: string; dryRun?: boolean; samples: string; explain?: string }) => {
    const db = getDb();
    try {
      // The tag list itself is code-owned: upsert names, kinds and order
      const tagIds = new Map<string, string>();
      for (const [order, t] of TAGS.entries()) {
        const data = { kind: t.kind, order, nameAz: t.az, nameRu: t.ru, nameEn: t.en };
        const tag = opts.dryRun
          ? await db.tag.findUnique({ where: { slug: t.slug } })
          : await db.tag.upsert({ where: { slug: t.slug }, create: { slug: t.slug, ...data }, update: data });
        if (tag) tagIds.set(t.slug, tag.id);
      }

      const works = await db.work.findMany({
        where: {
          status: 'PUBLISHED',
          ...(opts.author && { author: { slug: opts.author } }),
          ...(opts.explain && { slug: opts.explain }),
        },
        select: {
          id: true,
          slug: true,
          titleAz: true,
          genre: true,
          form: true,
          year: true,
          body: true,
          originalLang: true,
          author: { select: { slug: true } },
          collection: { select: { titleAz: true } },
          translations: { where: { status: 'PUBLISHED' }, select: { language: true, body: true } },
        },
      });

      const counts = new Map<string, number>();
      const samples = new Map<string, string[]>();
      const sampleCount = Number(opts.samples) || 0;
      let untagged = 0;
      let written = 0;

      for (const w of works) {
        const { tags, scores, matched } = tagsFor({
          genre: w.genre,
          form: w.form,
          year: w.year,
          authorSlug: w.author.slug,
          collectionTitle: w.collection?.titleAz ?? null,
          titleAz: w.titleAz,
          texts: [
            { lang: w.originalLang, body: w.body },
            ...w.translations.map((t) => ({ lang: t.language, body: t.body })),
          ],
        });
        if (opts.explain) {
          console.log(`${w.slug}: ${tags.join(', ') || '(none)'}`);
          for (const [k, v] of Object.entries(scores).filter(([, v]) => v > 0)) {
            console.log(`  ${k.padEnd(12)} ${String(v).padStart(5)}  ${(matched[k] ?? []).join(' ')}`);
          }
          return;
        }
        const themesOrMoods = tags.filter((t) => TAGS.find((d) => d.slug === t)?.kind !== 'ERA');
        if (!themesOrMoods.length) untagged++;
        for (const t of tags) {
          counts.set(t, (counts.get(t) ?? 0) + 1);
          const list = samples.get(t) ?? [];
          if (list.length < sampleCount && Math.random() < 0.05) list.push(`${w.author.slug}: ${w.titleAz}`);
          samples.set(t, list);
        }

        if (!opts.dryRun) {
          await db.$transaction([
            db.workTag.deleteMany({ where: { workId: w.id, source: 'RULE' } }),
            db.workTag.createMany({
              data: tags.map((slug) => ({ workId: w.id, tagId: tagIds.get(slug)!, source: 'RULE' as const })),
              skipDuplicates: true, // an editor already set it
            }),
          ]);
          written++;
        }
      }

      console.log(`${works.length} works, ${untagged} with no theme, mood or length tag`);
      for (const t of TAGS) {
        console.log(`${t.kind.padEnd(8)} ${t.slug.padEnd(16)} ${String(counts.get(t.slug) ?? 0).padStart(5)}`);
        for (const s of samples.get(t.slug) ?? []) console.log(`           · ${s}`);
      }
      if (!opts.dryRun) console.log(`Tagged ${written} works`);
    } finally {
      await disconnectDb();
    }
  });
