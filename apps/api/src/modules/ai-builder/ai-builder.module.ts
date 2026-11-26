import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityModule } from '../entity/entity.module';
import { DashboardTemplateModule } from '../dashboard-template/dashboard-template.module';
import { PdfModule } from '../pdf/pdf.module';
import { UploadModule } from '../upload/upload.module';
import { AiBuilderController } from './ai-builder.controller';
import { AiBuilderService } from './ai-builder.service';
import { AiWorkspaceController } from './ai-workspace.controller';
import { AiWorkspaceService } from './ai-workspace.service';
import { AuditModule } from '../audit/audit.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';
import { CustomRoleModule } from '../custom-role/custom-role.module';
import { EntityAutomationModule } from '../entity-automation/entity-automation.module';

@Module({
  imports: [PrismaModule, EntityModule, DashboardTemplateModule, PdfModule, UploadModule, AuditModule, EntityDataQueryModule, CustomRoleModule, EntityAutomationModule],
  controllers: [AiBuilderController, AiWorkspaceController],
  providers: [AiBuilderService, AiWorkspaceService],
})
export class AiBuilderModule {}
