import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { AiApplyDto, AiProposeDto } from './ai-builder.dto';
import { AiBuilderService } from './ai-builder.service';

@ApiTags('AI Builder')
@Controller('ai-builder')
@ServiceScope('admin')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class AiBuilderController {
  constructor(private readonly service: AiBuilderService) {}

  @Get('status')
  @ApiOperation({ summary: 'O assistente de criacao esta ligado?' })
  status() {
    return this.service.status();
  }

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  @RequireModulePermission('entities', 'canCreate')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Conversa: devolve a proposta de tabelas atualizada (nada e criado)' })
  propose(@Body() dto: AiProposeDto, @CurrentUser() user: CurrentUserType) {
    return this.service.propose(dto, user);
  }

  @Post('apply')
  @RequireModulePermission('entities', 'canCreate')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Cria as tabelas da proposta' })
  apply(@Body() dto: AiApplyDto, @CurrentUser() user: CurrentUserType) {
    return this.service.apply(dto, user);
  }
}
