import { Command } from 'commander';
import { scrapeAuthorsCommand } from './commands/scrape-authors';
import { scrapeWorksCommand } from './commands/scrape-works';
import { auditCommand } from './commands/audit';
import { importMdCommand } from './commands/import-md';
import { scrapeAllCommand } from './commands/scrape-all';
import { reslugCommand } from './commands/reslug';
import { retitleCommand } from './commands/retitle';
import { scrapeImagesCommand } from './commands/scrape-images';
import { tagWorksCommand } from './commands/tag-works';

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
program.addCommand(tagWorksCommand);

program.parse();
