import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedRequest } from '../../common/types';

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
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('credentials')
  async getCredentials(
    @Request() req: AuthenticatedRequest,
    @Body() body: { tenantId?: string },
  ) {
    const user = req.user;

    // PLATFORM_ADMIN can override tenantId to sync another tenant's data
    const effectiveTenantId =
      user.customRole?.roleType === 'PLATFORM_ADMIN' && body.tenantId
        ? body.tenantId
        : user.tenantId;

    // Generate a PowerSync-specific token with sync-relevant claims.
    // PowerSync reads these via request.jwt() ->> 'tenantId' in sync rules.
    const token = this.jwtService.sign(
      {
        sub: user.id,
        user_id: user.id,
        tenantId: effectiveTenantId,
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
