import { Module } from '@nestjs/common';
import { PublicLinkService } from './public-link.service';
import { PublicLinkController } from './public-link.controller';
import { PublicLinkPublicController } from './public-link-public.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PublicLinkController, PublicLinkPublicController],
  providers: [PublicLinkService],
  exports: [PublicLinkService],
})
export class PublicLinkModule {}
