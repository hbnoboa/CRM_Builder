import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationController, InvitationPublicController } from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [AuthModule],
  controllers: [InvitationController, InvitationPublicController],
  providers: [InvitationService],
})
export class InvitationModule {}
