import { Command } from 'commander';
import { importAuthors } from '../importers/import-authors';
import { importCollections } from '../importers/import-collections';
import { importWorks } from '../importers/import-works';
import { importTranslations } from '../importers/import-translations';
import { importArtworks } from '../importers/import-artworks';
import { disconnectDb } from '../importers/db';

type ImportType = 'authors' | 'collections' | 'works' | 'translations' | 'artworks' | 'all';

export const importMdCommand = new Command('import-md')
  .description('Import .md files into the database via Prisma')
  .option('--type <type>', 'Import only a specific type: authors, collections, works, translations, artworks', 'all')
  .option('--author <slug>', 'Only import data for a specific author')
  .option('--dry-run', 'Show what would be imported without writing to DB')
  .option('--force', 'Overwrite existing records even if unchanged')
  .option('--publish', 'Override status to PUBLISHED for all imported records')
  .action(async (opts: { type: ImportType; author?: string; dryRun?: boolean; force?: boolean; publish?: boolean }) => {
    const commonOpts = {
      dryRun: opts.dryRun,
      force: opts.force,
      authorSlug: opts.author,
      publish: opts.publish,
    };

    try {
      const types = opts.type === 'all'
        ? ['authors', 'collections', 'works', 'translations', 'artworks'] as const
        : [opts.type] as const;

      for (const type of types) {
        console.log(`\n=== Importing ${type} ===\n`);

        switch (type) {
          case 'authors':
            await importAuthors(commonOpts);
            break;
          case 'collections':
            await importCollections(commonOpts);
            break;
          case 'works':
            await importWorks(commonOpts);
            break;
          case 'translations':
            await importTranslations(commonOpts);
            break;
          case 'artworks':
            await importArtworks(commonOpts);
            break;
        }
      }

      console.log('\nImport complete.');
    } finally {
      await disconnectDb();
    }
  });
