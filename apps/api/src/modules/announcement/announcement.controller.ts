import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { AnnouncementSeverity } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { PlatformAuthGuard } from '../platform/platform-jwt.strategy';
import { CurrentStaff, PlatformPermissionGuard, PlatformStaffPrincipal, RequirePlatformPermission } from '../platform/platform-permissions';
import { AnnouncementService, AUDIENCE_TYPES } from './announcement.service';

class AudienceDto {
  @IsIn([...AUDIENCE_TYPES]) type: (typeof AUDIENCE_TYPES)[number];
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) ids: string[];
}

class AnnouncementDto {
  @IsString() @MinLength(3) @MaxLength(120) title: string;
  @IsString() @MinLength(3) @MaxLength(2000) body: string;
  @IsOptional() @IsEnum(AnnouncementSeverity) severity?: AnnouncementSeverity;
  @IsOptional() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
  @IsOptional() @IsBoolean() adminsOnly?: boolean;
  @IsOptional() @IsBoolean() dismissible?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsString() @MaxLength(500) linkUrl?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) linkLabel?: string | null;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() endsAt?: string | null;
}

class UpdateAnnouncementDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000) body?: string;
  @IsOptional() @IsEnum(AnnouncementSeverity) severity?: AnnouncementSeverity;
  @IsOptional() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
  @IsOptional() @IsBoolean() adminsOnly?: boolean;
  @IsOptional() @IsBoolean() dismissible?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsString() @MaxLength(500) linkUrl?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) linkLabel?: string | null;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() endsAt?: string | null;
}

class PublishDto {
  @IsBoolean() published: boolean;
}

/** Comunicados ativos para a pessoa logada. */
@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get('active')
  active(@CurrentUser() user: CurrentUserType) {
    return this.announcements.activeFor(user);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.announcements.dismiss(user, id);
  }
}

/** Console: criar, publicar e acompanhar comunicados. */
@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform/announcements')
@UseGuards(PlatformAuthGuard, PlatformPermissionGuard)
@ApiBearerAuth()
export class AnnouncementConsoleController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  @RequirePlatformPermission('announcements.read')
  list() {
    return this.announcements.list();
  }

  @Post('reach')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('announcements.read')
  reach(@Body() dto: AudienceDto) {
    return this.announcements.reach(dto);
  }

  @Post()
  @RequirePlatformPermission('announcements.manage')
  create(@CurrentStaff() staff: PlatformStaffPrincipal, @Body() dto: AnnouncementDto) {
    return this.announcements.create(staff, dto);
  }

  @Patch(':id')
  @RequirePlatformPermission('announcements.manage')
  update(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.update(staff, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('announcements.manage')
  publish(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: PublishDto) {
    return this.announcements.publish(staff, id, dto.published);
  }

  @Delete(':id')
  @RequirePlatformPermission('announcements.manage')
  remove(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string) {
    return this.announcements.remove(staff, id);
  }
}
