import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  All,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, RoleType } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedRequest, CurrentUser as CurrentUserType } from '../../common/types';
import { CustomApiService, QueryCustomApiDto } from './custom-api.service';
import { CreateCustomApiDto, UpdateCustomApiDto, HttpMethod } from './dto/custom-api.dto';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

@Controller('custom-apis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomApiController {
  private readonly logger = new Logger(CustomApiController.name);

  constructor(private readonly customApiService: CustomApiService) {}

  @Post()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async create(@Body() dto: CreateCustomApiDto & { tenantId?: string }, @CurrentUser() user: CurrentUserType) {
    const tenantId = getEffectiveTenantId(user, dto.tenantId);
    this.logger.log(`Creating custom API: ${dto.name} (tenant: ${tenantId})`);
    return this.customApiService.create(dto, tenantId);
  }

  @Get()
  async findAll(@Query() query: QueryCustomApiDto & { tenantId?: string }, @CurrentUser() user: CurrentUserType) {
    const tenantId = getEffectiveTenantId(user, query.tenantId);
    return this.customApiService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.customApiService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomApiDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.customApiService.update(id, dto, user.tenantId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.customApiService.toggleActive(id, user.tenantId);
  }

  @Patch(':id/activate')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async activate(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.customApiService.activate(id, user.tenantId);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async deactivate(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.customApiService.deactivate(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.customApiService.remove(id, user.tenantId);
  }
}

// Dynamic endpoint executor
@Controller('x/:tenantId')
@UseGuards(JwtAuthGuard)
export class DynamicApiController {
  private readonly logger = new Logger(DynamicApiController.name);

  constructor(private readonly customApiService: CustomApiService) {}

  @All('*')
  async handleDynamicRequest(@Req() req: AuthenticatedRequest, @Param('tenantId') tenantId: string) {
    // Validar que o usuario tem acesso ao tenant solicitado
    const userRoleType = req.user?.customRole?.roleType as RoleType | undefined;
    if (userRoleType !== 'PLATFORM_ADMIN' && req.user?.tenantId !== tenantId) {
      throw new ForbiddenException('Acesso negado a este tenant');
    }

    const path = (req.params as Record<string, string>)[0] || '';
    const method = req.method as HttpMethod;

    this.logger.log(`Executing custom endpoint: ${method} /${path} (tenant: ${tenantId}, user: ${req.user?.email})`);

    return this.customApiService.executeEndpoint(
      tenantId,
      `/${path}`,
      method,
      req.body as Record<string, unknown>,
      req.query as Record<string, string>,
      req.headers as unknown as Record<string, string>,
      req.user,
    );
  }
}
