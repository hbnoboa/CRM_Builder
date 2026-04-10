import { Module } from '@nestjs/common';
import { EntityService } from './entity.service';
import { EntityController } from './entity.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { CustomRoleModule } from '../custom-role/custom-role.module';
import { DashboardTemplateModule } from '../dashboard-template/dashboard-template.module';
import { ComputedFieldService } from './computed-field.service';
import { ComputedFieldMaterializerService } from './computed-field-materializer.service';
import { RecomputeFieldsJob } from './recompute-fields.job';

@Module({
  imports: [PrismaModule, NotificationModule, CustomRoleModule, DashboardTemplateModule],
  controllers: [EntityController],
  providers: [
    EntityService,
    ComputedFieldService,
    ComputedFieldMaterializerService,
    RecomputeFieldsJob,
  ],
  exports: [EntityService, ComputedFieldMaterializerService],
})
export class EntityModule {}
