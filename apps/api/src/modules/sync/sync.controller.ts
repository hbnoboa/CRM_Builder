import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/types';
import { hasPlatformAccess } from '../../common/utils/platform-access';

/**
 * Sync credentials endpoint for PowerSync.
 * The mobile app calls this to get a JWT token that PowerSync
 * can validate to determine which data to sync.
 *
 * The token includes tenantId and user_id as claims,
 * which PowerSync sync rules use to filter data per user.
 *
 * PLATFORM_ADMIN users can override tenantId to view
 * another tenant's data (mirrors web-admin tenant switching).
 */
@ServiceScope('user')
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('credentials')
  async getCredentials(
    @Request() req: AuthenticatedRequest,
    @Body() body: { tenantId?: string },
  ) {
    const user = req.user;

    const platformAdmin = hasPlatformAccess(user.customRole?.modulePermissions);

    // PLATFORM_ADMIN can override tenantId to sync another tenant's data
    const effectiveTenantId =
      platformAdmin && body.tenantId ? body.tenantId : user.tenantId;

    // Generate a PowerSync-specific token with sync-relevant claims.
    // PowerSync reads these via request.jwt() ->> 'key' in sync rules.
    // `platformAdmin` replaces the removed roleType claim: it gates the
    // cross-tenant bypass bucket (admin_all_entity_data) so a platform admin
    // syncing another tenant still receives role-filtered records whose
    // _visibleToRolesJson does not contain their (foreign) customRoleId.
    const token = this.jwtService.sign(
      {
        sub: user.id,
        user_id: user.id,
        tenantId: effectiveTenantId,
        customRoleId: user.customRoleId,
        platformAdmin,
      },
      { expiresIn: '1h' },
    );

    return {
      token,
      endpoint: process.env.POWERSYNC_URL || 'http://localhost:8080',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }
}
