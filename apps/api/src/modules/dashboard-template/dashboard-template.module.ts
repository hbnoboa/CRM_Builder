import { Module } from '@nestjs/common';
import { DashboardTemplateController } from './dashboard-template.controller';
import { DashboardTemplateService } from './dashboard-template.service';

@Module({
  controllers: [DashboardTemplateController],
  providers: [DashboardTemplateService],
  exports: [DashboardTemplateService],
})
export class DashboardTemplateModule {}
