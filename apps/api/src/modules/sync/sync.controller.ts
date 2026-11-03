import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/types';

/**
 * Sync credentials endpoint for PowerSync.
 * The mobile app calls this to get a JWT token that PowerSync
 * can validate to determine which data to sync.
 *
 * The token includes tenantId and user_id as claims,
 * which PowerSync sync rules use to filter data per user.
 *
 * Always scoped to the user's active tenant (membership resolved by JwtStrategy).
 */
@ServiceScope('user')
@RequireFeature('mobile')
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('credentials')
  // Body `tenantId` (sent by older mobile builds) is ignored: no cross-tenant sync.
  async getCredentials(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    // Generate a PowerSync-specific token with sync-relevant claims.
    // PowerSync reads these via request.jwt() ->> 'key' in sync rules.
    const token = this.jwtService.sign(
      {
        sub: user.id,
        user_id: user.id,
        tenantId: user.tenantId,
        customRoleId: user.customRoleId,
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
