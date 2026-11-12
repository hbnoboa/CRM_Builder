import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NoClientPortalGuard } from '../../common/guards/no-client-portal.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { PlatformAuthGuard } from '../platform/platform-jwt.strategy';
import { CurrentStaff, PlatformPermissionGuard, PlatformStaffPrincipal, RequirePlatformPermission } from '../platform/platform-permissions';
import { SUPPORT_CATEGORIES, SupportService } from './support.service';

class CreateTicketDto {
  @IsString() @MinLength(3) @MaxLength(150) subject: string;
  @IsIn([...SUPPORT_CATEGORIES]) category: string;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsString() @MinLength(3) @MaxLength(10000) body: string;
}

class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(10000) body: string;
}

class StaffReplyDto extends ReplyDto {
  @IsOptional() @IsBoolean() internal?: boolean;
}

class StaffUpdateDto {
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() assignedStaffId?: string | null;
}

class StaffListDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() tenantId?: string;
  @IsOptional() @IsString() assigned?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

/** "Falar com o suporte": chamados da propria empresa. */
@ApiTags('Support')
@Controller('support/tickets')
@UseGuards(JwtAuthGuard, NoClientPortalGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Meus chamados (ou todos da empresa, para quem administra)' })
  list(@CurrentUser() user: CurrentUserType, @Query('status') status?: string) {
    return this.support.listForCustomer(user, status);
  }

  @Post()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Abrir chamado' })
  create(@CurrentUser() user: CurrentUserType, @Body() dto: CreateTicketDto) {
    return this.support.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.support.getForCustomer(user, id);
  }

  @Post(':id/messages')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  reply(@CurrentUser() user: CurrentUserType, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.support.customerReply(user, id, dto.body);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.support.customerResolve(user, id);
  }
}

/** Console: fila de chamados da plataforma. */
@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform/support')
@UseGuards(PlatformAuthGuard, PlatformPermissionGuard)
@ApiBearerAuth()
export class SupportConsoleController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  @RequirePlatformPermission('support.read')
  list(@CurrentStaff() staff: PlatformStaffPrincipal, @Query() query: StaffListDto) {
    return this.support.staffList(query, staff);
  }

  @Get('counts')
  @RequirePlatformPermission('support.read')
  counts(@CurrentStaff() staff: PlatformStaffPrincipal) {
    return this.support.staffCounts(staff);
  }

  @Get('tickets/:id')
  @RequirePlatformPermission('support.read')
  get(@Param('id') id: string) {
    return this.support.staffGet(id);
  }

  @Post('tickets/:id/messages')
  @RequirePlatformPermission('support.reply')
  reply(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: StaffReplyDto) {
    return this.support.staffReply(staff, id, dto.body, !!dto.internal);
  }

  @Patch('tickets/:id')
  @RequirePlatformPermission('support.reply')
  update(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: StaffUpdateDto) {
    return this.support.staffUpdate(staff, id, dto);
  }
}
