import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h', audience: 'powersync' },
    }),
  ],
  controllers: [SyncController],
})
export class SyncModule {}
