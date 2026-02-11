import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto, QueryTenantDto } from './dto/tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // Endpoint para usuario autenticado obter seu proprio tenant
  @Get('me')
  @ApiOperation({ summary: 'Obter tenant do usuario atual' })
  async getMyTenant(@CurrentUser() user: CurrentUserType) {
    return this.tenantService.findOne(user.tenantId);
  }

  @Post()
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Criar novo tenant' })
  @ApiResponse({ status: 201, description: 'Tenant criado' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Listar tenants' })
  async findAll(@Query() query: QueryTenantDto) {
    return this.tenantService.findAll(query);
  }

  @Get('stats')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Estatísticas de tenants' })
  async getStats() {
    return this.tenantService.getStats();
  }

  @Get(':id')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Buscar tenant por ID' })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atualizar tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Suspender tenant' })
  async suspend(@Param('id') id: string) {
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Ativar tenant' })
  async activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }

  @Delete(':id')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir tenant' })
  async remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
