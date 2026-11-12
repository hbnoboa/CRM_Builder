import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { UploadModule } from '../upload/upload.module';
import { PlatformAuthController, PlatformController } from './platform.controller';
import { PlatformJwtStrategy } from './platform-jwt.strategy';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformPlansService } from './platform-plans.service';
import { PlatformStaffService } from './platform-staff.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformUsersService } from './platform-users.service';
import { PlatformBulkService } from './platform-bulk.service';
import { PlatformTenantTeamService } from './platform-tenant-team.service';

/**
 * Console da plataforma (/admin no web-admin, /platform na API).
 * Autenticacao propria (PlatformStaff + token com audience 'platform'),
 * separada dos usuarios e cargos dos tenants.
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), AuthModule, TenantModule, UploadModule],
  controllers: [PlatformAuthController, PlatformController],
  providers: [
    PlatformJwtStrategy,
    PlatformAuditService,
    PlatformPlansService,
    PlatformStaffService,
    PlatformTenantsService,
    PlatformTenantTeamService,
    PlatformMetricsService,
    PlatformUsersService,
    PlatformBulkService,
  ],
})
export class PlatformModule {}
