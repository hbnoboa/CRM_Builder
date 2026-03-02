import { Module } from '@nestjs/common';
import { ActionChainService } from './action-chain.service';
import { ActionChainController } from './action-chain.controller';
import { WebhookModule } from '../webhook/webhook.module';
import { EmailTemplateModule } from '../email-template/email-template.module';

@Module({
  imports: [WebhookModule, EmailTemplateModule],
  controllers: [ActionChainController],
  providers: [ActionChainService],
  exports: [ActionChainService],
})
export class ActionChainModule {}
