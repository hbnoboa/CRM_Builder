import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsIn, MaxLength, ValidateNested } from 'class-validator';
import { PushService } from './push.service';
import { WebPushService, isPushEndpoint } from './web-push.service';
import { CurrentUser as CurrentUserType } from '../../common/types';

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

class WebPushKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @IsString()
  @MaxLength(100)
  auth: string;
}

class WebPushSubscribeDto {
  @IsString()
  @MaxLength(1000)
  endpoint: string;

  @ValidateNested()
  @Type(() => WebPushKeysDto)
  keys: WebPushKeysDto;
}

class WebPushEndpointDto {
  @IsString()
  @MaxLength(1000)
  endpoint: string;
}

/** Notificacao no navegador (aplicativo instalavel): inscrever este aparelho na empresa atual. */
@ApiTags('Push')
@ApiBearerAuth()
@Controller('push/web')
@UseGuards(JwtAuthGuard)
export class WebPushController {
  constructor(private readonly webPush: WebPushService) {}

  @Get('config')
  @ApiOperation({ summary: 'Chave publica e se a empresa permite notificacao no navegador' })
  async config(@CurrentUser() user: CurrentUserType) {
    const available = await this.webPush.availableFor(user.tenantId);
    return { available, publicKey: available ? this.webPush.vapidPublicKey : null };
  }

  @Post('status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Este aparelho esta inscrito na empresa atual?' })
  async status(@CurrentUser() user: CurrentUserType, @Body() dto: WebPushEndpointDto) {
    return { subscribed: await this.webPush.isSubscribed(user.id, user.tenantId, dto.endpoint) };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Inscrever este aparelho para notificacoes da empresa atual' })
  async subscribe(@CurrentUser() user: CurrentUserType, @Body() dto: WebPushSubscribeDto, @Headers('user-agent') userAgent?: string) {
    if (!(await this.webPush.availableFor(user.tenantId))) throw new BadRequestException('Notificação no navegador não está disponível nesta empresa');
    if (!isPushEndpoint(dto.endpoint)) throw new BadRequestException('Endereço de notificação inválido');
    await this.webPush.subscribe(user.id, user.tenantId, { endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent });
    return { success: true };
  }

  @Delete('subscribe')
  @ApiOperation({ summary: 'Parar de receber neste aparelho' })
  async unsubscribe(@CurrentUser('id') userId: string, @Body() dto: WebPushEndpointDto) {
    await this.webPush.unsubscribe(userId, dto.endpoint);
    return { success: true };
  }
}
