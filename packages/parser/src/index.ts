import { Command } from 'commander';
import { scrapeAuthorsCommand } from './commands/scrape-authors';
import { scrapeWorksCommand } from './commands/scrape-works';
import { auditCommand } from './commands/audit';
import { importMdCommand } from './commands/import-md';
import { scrapeAllCommand } from './commands/scrape-all';
import { reslugCommand } from './commands/reslug';
import { retitleCommand } from './commands/retitle';
import { scrapeImagesCommand } from './commands/scrape-images';
import { scrapeTranslationsCommand } from './commands/scrape-translations';
import { scrapePortraitsCommand } from './commands/scrape-portraits';
import { scrapeLifespansCommand } from './commands/scrape-lifespans';
import { scrapeReprintCommand } from './commands/scrape-reprint';
import { tagWorksCommand } from './commands/tag-works';
import { scrapeBookCommand } from './commands/scrape-book';

const program = new Command()
  .name('irs-parser')
  .description('IRS.AZ data parser — scrape, validate, and import literary data')
  .version('1.0.0');

program.addCommand(scrapeAuthorsCommand);
program.addCommand(scrapeWorksCommand);
program.addCommand(scrapeAllCommand);
program.addCommand(auditCommand);
program.addCommand(importMdCommand);
program.addCommand(reslugCommand);
program.addCommand(retitleCommand);
program.addCommand(scrapeImagesCommand);
program.addCommand(scrapeTranslationsCommand);
program.addCommand(scrapePortraitsCommand);
program.addCommand(scrapeLifespansCommand);
program.addCommand(scrapeReprintCommand);
program.addCommand(tagWorksCommand);
program.addCommand(scrapeBookCommand);

program.parse();
