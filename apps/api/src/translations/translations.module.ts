import { Module } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [TranslationsController],
  providers: [TranslationsService],
  exports: [TranslationsService],
})
export class TranslationsModule {}
