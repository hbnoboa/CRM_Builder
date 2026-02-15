import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Sync credentials endpoint for PowerSync.
 * The mobile app calls this to get a JWT token that PowerSync
 * can validate to determine which data to sync.
 *
 * The token includes tenant_id and user_id as claims,
 * which PowerSync sync rules use to filter data per user.
 */
@Controller('sync')
export class SyncController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('credentials')
  @UseGuards(JwtAuthGuard)
  async getCredentials(@Request() req) {
    const user = req.user;

    // Generate a PowerSync-specific token with sync-relevant claims.
    // PowerSync reads these via token_parameters in sync rules.
    const token = this.jwtService.sign(
      {
        sub: user.id,
        user_id: user.id,
        tenant_id: user.tenantId,
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
