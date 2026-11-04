import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ApiKeyService } from './api-key.service';

class CreateApiKeyDto {
  @ApiProperty({ example: 'Integracao ERP' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ description: 'Cargo que a chave usa (abaixo do seu)' })
  @IsString()
  customRoleId: string;

  @ApiPropertyOptional({ enum: [30, 90, 365], nullable: true, description: 'Validade em dias; vazio = sem vencimento' })
  @IsOptional()
  @IsIn([30, 90, 365, null])
  expiresInDays?: number | null;
}

@ApiTags('API Keys')
@ServiceScope('admin')
@Controller('api-keys')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Get()
  @RequireModulePermission('apis', 'canRead')
  @ApiOperation({ summary: 'Chaves de API ativas da empresa' })
  list(@CurrentUser() user: CurrentUserType) {
    return this.apiKeys.list(user);
  }

  @Post()
  @RequireModulePermission('apis', 'canCreate')
  @ApiOperation({ summary: 'Criar chave de API (a chave so aparece nesta resposta)' })
  create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: CurrentUserType) {
    return this.apiKeys.create(user, dto);
  }

  @Delete(':id')
  @RequireModulePermission('apis', 'canDelete')
  @ApiOperation({ summary: 'Revogar chave de API' })
  revoke(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.apiKeys.revoke(user, id);
  }
}
