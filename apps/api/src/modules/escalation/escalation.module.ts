import { Module, forwardRef } from '@nestjs/common';
import { EscalationService } from './escalation.service';
import { NotificationModule } from '../notification/notification.module';
import { ActionChainModule } from '../action-chain/action-chain.module';

@Module({
  imports: [
    NotificationModule,
    forwardRef(() => ActionChainModule),
  ],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
