import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsIn } from 'class-validator';
import { PushService } from './push.service';

class RegisterDeviceDto {
  @IsString()
  token: string;

  @IsString()
  @IsIn(['android', 'ios', 'web'])
  platform: string;
}

class UnregisterDeviceDto {
  @IsString()
  token: string;
}

@ApiTags('Push')
@ApiBearerAuth()
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register-device')
  @ApiOperation({ summary: 'Registrar device token para push notifications' })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.pushService.registerDevice(userId, dto.token, dto.platform);
    return { success: true };
  }

  @Delete('unregister-device')
  @ApiOperation({ summary: 'Remover device token' })
  async unregisterDevice(@Body() dto: UnregisterDeviceDto) {
    await this.pushService.unregisterDevice(dto.token);
    return { success: true };
  }
}
