import { Module, forwardRef } from '@nestjs/common';
import { EntityAutomationService } from './entity-automation.service';
import { EntityAutomationController } from './entity-automation.controller';
import { AutomationExecutorService } from './automation-executor.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { EmailTemplateModule } from '../email-template/email-template.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    forwardRef(() => EmailTemplateModule),
    forwardRef(() => NotificationModule),
  ],
  controllers: [EntityAutomationController],
  providers: [
    EntityAutomationService,
    AutomationExecutorService,
    AutomationSchedulerService,
  ],
  exports: [EntityAutomationService],
})
export class EntityAutomationModule {}
