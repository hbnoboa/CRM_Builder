import { Module, forwardRef } from '@nestjs/common';
import { EntityAutomationService } from './entity-automation.service';
import { EntityAutomationController } from './entity-automation.controller';
import { AutomationExecutorService } from './automation-executor.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { ExecutionContextService } from './execution-context.service';
import { CircuitBreakerService } from './circuit-breaker.service';
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
    ExecutionContextService,
    CircuitBreakerService,
  ],
  exports: [EntityAutomationService],
})
export class EntityAutomationModule {}
