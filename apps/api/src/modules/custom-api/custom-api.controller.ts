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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, RoleType } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedRequest } from '../../common/types';
import { CustomApiService, QueryCustomApiDto } from './custom-api.service';
import { CreateCustomApiDto, UpdateCustomApiDto, HttpMethod } from './dto/custom-api.dto';

@Controller('custom-apis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomApiController {
  private readonly logger = new Logger(CustomApiController.name);

  constructor(private readonly customApiService: CustomApiService) {}

  // Helper: PLATFORM_ADMIN can target any tenant via body.tenantId or query.tenantId
  private getEffectiveTenantId(user: any, requestedTenantId?: string): string {
    const roleType = user.customRole?.roleType as RoleType | undefined;
    if (roleType === 'PLATFORM_ADMIN' && requestedTenantId) {
      return requestedTenantId;
    }
    return user.tenantId;
  }

  @Post()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async create(@Body() dto: CreateCustomApiDto & { tenantId?: string }, @CurrentUser() user: any) {
    const tenantId = this.getEffectiveTenantId(user, dto.tenantId);
    this.logger.log(`Creating custom API: ${dto.name} (tenant: ${tenantId})`);
    return this.customApiService.create(dto, tenantId);
  }

  @Get()
  async findAll(@Query() query: QueryCustomApiDto & { tenantId?: string }, @CurrentUser() user: any) {
    const tenantId = this.getEffectiveTenantId(user, query.tenantId);
    return this.customApiService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomApiDto,
    @CurrentUser() user: any,
  ) {
    return this.customApiService.update(id, dto, user.tenantId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.toggleActive(id, user.tenantId);
  }

  @Patch(':id/activate')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async activate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.activate(id, user.tenantId);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.deactivate(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
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
