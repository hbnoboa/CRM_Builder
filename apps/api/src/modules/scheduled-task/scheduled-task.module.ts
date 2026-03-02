import { Module } from '@nestjs/common';
import { ScheduledTaskService } from './scheduled-task.service';
import { ScheduledTaskController } from './scheduled-task.controller';
import { ActionChainModule } from '../action-chain/action-chain.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [ActionChainModule, WebhookModule],
  controllers: [ScheduledTaskController],
  providers: [ScheduledTaskService],
  exports: [ScheduledTaskService],
})
export class ScheduledTaskModule {}
