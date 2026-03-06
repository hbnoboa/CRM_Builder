import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { EntityModule } from './modules/entity/entity.module';
import { DataModule } from './modules/data/data.module';
import { StatsModule } from './modules/stats/stats.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HealthModule } from './modules/health/health.module';
import { CustomRoleModule } from './modules/custom-role/custom-role.module';
import { SyncModule } from './modules/sync/sync.module';
import { PushModule } from './modules/push/push.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { AuditModule } from './modules/audit/audit.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { EmailTemplateModule } from './modules/email-template/email-template.module';
import { ActionChainModule } from './modules/action-chain/action-chain.module';
import { ScheduledTaskModule } from './modules/scheduled-task/scheduled-task.module';
import { EscalationModule } from './modules/escalation/escalation.module';
import { ExecutionLogsModule } from './modules/execution-logs/execution-logs.module';
import { EntityAutomationModule } from './modules/entity-automation/entity-automation.module';
import { EntityFieldRuleModule } from './modules/entity-field-rule/entity-field-rule.module';

@Module({
  imports: [
    // Configuracao
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
      limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
    }]),

    // Database
    PrismaModule,

    // Health Check
    HealthModule,

    // Modules
    AuthModule,
    UserModule,
    TenantModule,
    EntityModule,
    DataModule,
    CustomRoleModule,
    StatsModule,
    UploadModule,
    NotificationModule,
    SyncModule,
    PushModule,
    PdfModule,
    AuditModule,
    ArchiveModule,

    // Automacoes (Sprint 3)
    WebhookModule,
    EmailTemplateModule,
    ActionChainModule,
    ScheduledTaskModule,

    // Avancado (Sprint 4)
    EscalationModule,
    ExecutionLogsModule,

    // Automacoes Unificadas (Sprint 5)
    EntityAutomationModule,
    EntityFieldRuleModule,
  ],
})
export class AppModule {}
