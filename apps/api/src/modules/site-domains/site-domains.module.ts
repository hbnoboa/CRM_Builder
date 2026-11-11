import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformAuditService } from '../platform/platform-audit.service';
import { DomainOrdersConsoleController, SiteDomainsController, SiteDomainsPublicController } from './site-domains.controller';
import { SiteDomainsService } from './site-domains.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SiteDomainsController, SiteDomainsPublicController, DomainOrdersConsoleController],
  providers: [SiteDomainsService, PlatformAuditService],
  exports: [SiteDomainsService],
})
export class SiteDomainsModule {}
