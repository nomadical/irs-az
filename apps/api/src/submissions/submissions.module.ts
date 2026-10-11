import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { PublicSubmissionsController } from './public-submissions.controller';
import { AuthorsModule } from '../authors/authors.module';
import { WorksModule } from '../works/works.module';
import { TranslationsModule } from '../translations/translations.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [AuthorsModule, WorksModule, TranslationsModule, SearchModule],
  controllers: [PublicSubmissionsController, SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
