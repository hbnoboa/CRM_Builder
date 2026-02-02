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
import { UserRole } from '@prisma/client';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN) // Apenas Platform Admin
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo tenant' })
  @ApiResponse({ status: 201, description: 'Tenant criado' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tenants' })
  async findAll(@Query() query: QueryTenantDto) {
    return this.tenantService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de tenants' })
  async getStats() {
    return this.tenantService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar tenant por ID' })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspender tenant' })
  async suspend(@Param('id') id: string) {
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Ativar tenant' })
  async activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir tenant' })
  async remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
