import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';
import { DataModule } from '../data/data.module';
import { UploadModule } from '../upload/upload.module';
import { PdfModule } from '../pdf/pdf.module';
import { RecordTrackingController, SitePagesController } from './site-pages.controller';
import { SitePublicController } from './site-public.controller';
import { SitePagesService } from './site-pages.service';
import { SiteFontsService } from './site-fonts.service';

@Module({
  imports: [PrismaModule, EntityDataQueryModule, DataModule, UploadModule, PdfModule],
  controllers: [SitePagesController, RecordTrackingController, SitePublicController],
  providers: [SitePagesService, SiteFontsService],
})
export class SitePagesModule {}
