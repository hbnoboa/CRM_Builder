import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TeamDirectoryController } from './team-directory.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [UserController, TeamDirectoryController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
