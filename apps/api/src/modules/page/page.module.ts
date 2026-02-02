import { Module } from '@nestjs/common';
import { PageService } from './page.service';
import { PageController, PublicPageController } from './page.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PageController, PublicPageController],
  providers: [PageService],
  exports: [PageService],
})
export class PageModule {}
