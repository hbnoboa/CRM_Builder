import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import type { Request } from 'express';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import {
  CreatePlanDto,
  CreatePlatformStaffDto,
  PlatformChangePasswordDto,
  PlatformCreateTenantDto,
  PlatformLoginDto,
  PlatformQueryAuditDto,
  PlatformQueryTenantsDto,
  PlatformTenantFeaturesDto,
  PlatformTenantLifecycleDto,
  PlatformTenantAddMemberDto,
  PlatformTenantOwnerDto,
  PlatformTenantPlanDto,
  PlatformUpdateTenantDto,
  UpdatePlanDto,
  UpdatePlatformStaffDto,
} from './dto/platform.dto';
import { PlatformAuthGuard } from './platform-jwt.strategy';
import {
  CurrentStaff,
  PlatformPermissionGuard,
  PlatformStaffPrincipal,
  RequirePlatformPermission,
  requestIp,
} from './platform-permissions';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformPlansService } from './platform-plans.service';
import { PlatformStaffService } from './platform-staff.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformUsersService } from './platform-users.service';
import { PlatformTenantTeamService } from './platform-tenant-team.service';
import { CopyTenantDataDto } from '../tenant/dto/copy-tenant-data.dto';

@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly staffService: PlatformStaffService) {}

  @Post('login')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login da equipe da plataforma' })
  login(@Body() dto: PlatformLoginDto, @Req() req: Request) {
    return this.staffService.login(dto, requestIp(req));
  }

  @Get('me')
  @UseGuards(PlatformAuthGuard)
  @ApiBearerAuth()
  me(@CurrentStaff() staff: PlatformStaffPrincipal) {
    return this.staffService.me(staff);
  }

  @Post('change-password')
  @UseGuards(PlatformAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentStaff() staff: PlatformStaffPrincipal, @Body() dto: PlatformChangePasswordDto) {
    return this.staffService.changePassword(staff, dto);
  }
}

@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform')
@UseGuards(PlatformAuthGuard, PlatformPermissionGuard)
@ApiBearerAuth()
export class PlatformController {
  constructor(
    private readonly tenants: PlatformTenantsService,
    private readonly plans: PlatformPlansService,
    private readonly staff: PlatformStaffService,
    private readonly audit: PlatformAuditService,
    private readonly team: PlatformTenantTeamService,
    private readonly metricsService: PlatformMetricsService,
    private readonly usersService: PlatformUsersService,
  ) {}

  // ── Visao geral ─────────────────────────────────────────────────────────

  @Get('overview')
  @RequirePlatformPermission('overview.read')
  overview() {
    return this.tenants.overview();
  }

  @Get('metrics')
  @RequirePlatformPermission('metrics.read')
  metrics(@Query('months') months?: string) {
    const n = Math.min(24, Math.max(3, parseInt(months ?? '12', 10) || 12));
    return this.metricsService.metrics(n);
  }

  // ── Pessoas (busca global) ──────────────────────────────────────────────

  @Get('users')
  @RequirePlatformPermission('users.read')
  searchUsers(@Query('q') q?: string) {
    return this.usersService.search(q ?? '');
  }

  @Get('users/:id')
  @RequirePlatformPermission('users.read')
  userDetail(@Param('id') id: string) {
    return this.usersService.detail(id);
  }

  @Post('users/:id/password-reset')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('users.support')
  userPasswordReset(@CurrentStaff() actor: PlatformStaffPrincipal, @Param('id') id: string) {
    return this.usersService.sendPasswordReset(actor, id);
  }

  @Post('users/:id/logout')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('users.support')
  userLogout(@CurrentStaff() actor: PlatformStaffPrincipal, @Param('id') id: string) {
    return this.usersService.logoutEverywhere(actor, id);
  }

  @Post('users/:id/mfa-reset')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('users.support')
  userMfaReset(@CurrentStaff() actor: PlatformStaffPrincipal, @Param('id') id: string) {
    return this.usersService.resetMfa(actor, id);
  }

  // ── Tenants ─────────────────────────────────────────────────────────────

  @Get('tenants')
  @RequirePlatformPermission('tenants.read')
  findTenants(@Query() query: PlatformQueryTenantsDto) {
    return this.tenants.findAll(query);
  }

  @Post('tenants')
  @RequirePlatformPermission('tenants.create')
  createTenant(@CurrentStaff() actor: PlatformStaffPrincipal, @Body() dto: PlatformCreateTenantDto) {
    return this.tenants.create(actor, dto);
  }

  @Get('tenants/:id')
  @RequirePlatformPermission('tenants.read')
  findTenant(@Param('id') id: string) {
    return this.tenants.findOne(id);
  }

  @Get('tenants/:id/members')
  @RequirePlatformPermission('tenants.read')
  findMembers(@Param('id') id: string) {
    return this.tenants.findMembers(id);
  }

  @Patch('tenants/:id')
  @RequirePlatformPermission('tenants.update')
  updateTenant(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: PlatformUpdateTenantDto,
  ) {
    return this.tenants.update(actor, id, dto);
  }

  @Patch('tenants/:id/lifecycle')
  @RequirePlatformPermission('tenants.lifecycle')
  setLifecycle(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: PlatformTenantLifecycleDto,
  ) {
    return this.tenants.setLifecycle(actor, id, dto);
  }

  @Patch('tenants/:id/plan')
  @RequirePlatformPermission('tenants.plan')
  setPlan(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: PlatformTenantPlanDto,
  ) {
    return this.tenants.setPlan(actor, id, dto.planId);
  }

  @Patch('tenants/:id/features')
  @RequirePlatformPermission('tenants.features')
  setFeatures(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: PlatformTenantFeaturesDto,
  ) {
    return this.tenants.setFeatures(actor, id, dto);
  }

  @Post('tenants/:id/storage/recompute')
  @RequirePlatformPermission('tenants.update')
  @HttpCode(HttpStatus.OK)
  recomputeStorage(@CurrentStaff() actor: PlatformStaffPrincipal, @Param('id') id: string) {
    return this.tenants.recomputeStorage(actor, id);
  }

  @Post('tenants/:id/users/:userId/impersonate')
  @RequirePlatformPermission('tenants.impersonate')
  @HttpCode(HttpStatus.OK)
  impersonate(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.tenants.impersonate(actor, id, userId, requestIp(req));
  }

  @Get('tenants/:id/roles')
  @RequirePlatformPermission('tenants.read')
  findRoles(@Param('id') id: string) {
    return this.team.findRoles(id);
  }

  @Delete('tenants/:id/roles/:roleId')
  @RequirePlatformPermission('tenants.update')
  deleteUnusedRole(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.team.deleteUnusedRole(actor, id, roleId);
  }

  @Patch('tenants/:id/owner')
  @RequirePlatformPermission('tenants.update')
  setOwner(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: PlatformTenantOwnerDto,
  ) {
    return this.team.setOwner(actor, id, dto.userId);
  }

  @Post('tenants/:id/members')
  @RequirePlatformPermission('tenants.update')
  addMember(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: PlatformTenantAddMemberDto,
  ) {
    return this.team.addMember(actor, id, dto);
  }

  @Get('tenants/:id/copyable-data')
  @RequirePlatformPermission('tenants.read')
  getCopyableData(@Param('id') id: string) {
    return this.team.getCopyableData(id);
  }

  @Post('tenants/copy-data')
  @RequirePlatformPermission('tenants.update')
  copyData(@CurrentStaff() actor: PlatformStaffPrincipal, @Body() dto: CopyTenantDataDto) {
    return this.team.copyData(actor, dto);
  }

  // ── Planos ──────────────────────────────────────────────────────────────

  @Get('plans')
  @RequirePlatformPermission('plans.read')
  findPlans() {
    return this.plans.findAll();
  }

  @Post('plans')
  @RequirePlatformPermission('plans.manage')
  createPlan(@CurrentStaff() actor: PlatformStaffPrincipal, @Body() dto: CreatePlanDto) {
    return this.plans.create(actor, dto);
  }

  @Patch('plans/:id')
  @RequirePlatformPermission('plans.manage')
  updatePlan(@CurrentStaff() actor: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(actor, id, dto);
  }

  // ── Equipe ──────────────────────────────────────────────────────────────

  @Get('staff')
  @RequirePlatformPermission('staff.read')
  findStaff() {
    return this.staff.findAll();
  }

  @Post('staff')
  @RequirePlatformPermission('staff.manage')
  createStaff(@CurrentStaff() actor: PlatformStaffPrincipal, @Body() dto: CreatePlatformStaffDto) {
    return this.staff.create(actor, dto);
  }

  @Patch('staff/:id')
  @RequirePlatformPermission('staff.manage')
  updateStaff(
    @CurrentStaff() actor: PlatformStaffPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformStaffDto,
  ) {
    return this.staff.update(actor, id, dto);
  }

  @Delete('staff/:id')
  @RequirePlatformPermission('staff.manage')
  removeStaff(@CurrentStaff() actor: PlatformStaffPrincipal, @Param('id') id: string) {
    return this.staff.remove(actor, id);
  }

  // ── Auditoria ───────────────────────────────────────────────────────────

  @Get('audit-logs')
  @RequirePlatformPermission('audit.read')
  findAudit(@Query() query: PlatformQueryAuditDto) {
    return this.audit.findAll(query);
  }
}
