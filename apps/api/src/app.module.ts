import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuthorsModule } from './authors/authors.module';
import { CollectionsModule } from './collections/collections.module';
import { WorksModule } from './works/works.module';
import { TranslationsModule } from './translations/translations.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SearchModule } from './search/search.module';
import { BlogModule } from './blog/blog.module';
import { UploadModule } from './upload/upload.module';
import { SitemapModule } from './sitemap/sitemap.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AuthorsModule,
    CollectionsModule,
    WorksModule,
    TranslationsModule,
    SubmissionsModule,
    SearchModule,
    BlogModule,
    UploadModule,
    SitemapModule,
  ],
})
export class AppModule {}
