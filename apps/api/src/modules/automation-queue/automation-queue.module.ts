import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AutomationQueueProcessor } from './automation-queue.processor';
import { EntityAutomationModule } from '../entity-automation/entity-automation.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullModule.registerQueue({
      name: 'automation-execution',
    }),
    EntityAutomationModule,
  ],
  providers: [AutomationQueueProcessor],
  // Sem controller: as operacoes sao globais (todas as empresas) e nao cabem em
  // nenhum cargo de empresa. Se voltarem, entram no console da plataforma.
  exports: [BullModule],
})
export class AutomationQueueModule {}
