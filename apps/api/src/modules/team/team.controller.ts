import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { TeamService } from './team.service';

class TeamDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}

class UpdateTeamDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string | null;
}

class TeamMemberDto {
  @IsString() userId: string;
  @IsOptional() @IsBoolean() isLeader?: boolean;
}

class SetMembersDto {
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => TeamMemberDto)
  members: TeamMemberDto[];
}

/** Equipes: ver (users.read) e montar (users.update). */
@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teams: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'Equipes da empresa com membros' })
  list(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'users', 'canRead');
    return this.teams.list(user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar equipe' })
  create(@CurrentUser() user: CurrentUserType, @Body() dto: TeamDto) {
    checkModulePermission(user, 'users', 'canUpdate');
    return this.teams.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomear/editar equipe' })
  update(@CurrentUser() user: CurrentUserType, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    checkModulePermission(user, 'users', 'canUpdate');
    return this.teams.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir equipe (os registros continuam; so a visibilidade por equipe muda)' })
  remove(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    checkModulePermission(user, 'users', 'canUpdate');
    return this.teams.remove(user, id);
  }

  @Put(':id/members')
  @ApiOperation({ summary: 'Definir membros e lideres da equipe' })
  setMembers(@CurrentUser() user: CurrentUserType, @Param('id') id: string, @Body() dto: SetMembersDto) {
    checkModulePermission(user, 'users', 'canUpdate');
    return this.teams.setMembers(user, id, dto.members);
  }
}
