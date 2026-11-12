import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { DataService } from './data.service';
import { TRASH_RETENTION_OPTIONS, TrashService } from './trash.service';

class TrashQueryDto {
  @IsOptional() @IsString() entitySlug?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

class TrashSettingsDto {
  @ValidateIf((_, v) => v !== null)
  @IsIn([...TRASH_RETENTION_OPTIONS])
  retentionDays: number | null;
}

class EmptyTrashDto {
  @IsOptional() @IsString() entitySlug?: string;
}

/** Lixeira: registros excluidos que ainda podem ser restaurados. */
@ApiTags('Trash')
@Controller('trash')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrashController {
  constructor(
    private readonly trash: TrashService,
    private readonly dataService: DataService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Itens da lixeira (tabelas em que a pessoa pode excluir)' })
  list(@CurrentUser() user: CurrentUserType, @Query() query: TrashQueryDto) {
    return this.trash.list(user, query);
  }

  @Get('tables')
  @ApiOperation({ summary: 'Tabelas com itens na lixeira' })
  tables(@CurrentUser() user: CurrentUserType) {
    return this.trash.tables(user);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Prazo de apagamento automatico' })
  settings(@CurrentUser() user: CurrentUserType) {
    return this.trash.settings(user.tenantId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Alterar o prazo (null = nunca apagar sozinho)' })
  updateSettings(@CurrentUser() user: CurrentUserType, @Body() dto: TrashSettingsDto) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.trash.updateSettings(user, dto.retentionDays ?? null);
  }

  @Post('empty')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Esvaziar a lixeira (toda ou de uma tabela)' })
  empty(@CurrentUser() user: CurrentUserType, @Body() dto: EmptyTrashDto) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.trash.empty(user, dto.entitySlug);
  }

  @Post(':entitySlug/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar (volta com os sub-registros excluidos junto)' })
  restore(@CurrentUser() user: CurrentUserType, @Param('entitySlug') entitySlug: string, @Param('id') id: string) {
    return this.dataService.restore(entitySlug, id, user);
  }

  @Delete(':entitySlug/:id')
  @ApiOperation({ summary: 'Apagar de vez' })
  purge(@CurrentUser() user: CurrentUserType, @Param('entitySlug') entitySlug: string, @Param('id') id: string) {
    return this.dataService.purge(entitySlug, id, user);
  }
}
