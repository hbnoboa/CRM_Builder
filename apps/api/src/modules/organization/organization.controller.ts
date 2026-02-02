import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService, QueryOrganizationDto } from './organization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Criar organização' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.organizationService.create(dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Listar organizações' })
  async findAll(@Query() query: QueryOrganizationDto, @CurrentUser() user: any) {
    return this.organizationService.findAll(query, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Buscar organização' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Atualizar organização' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.organizationService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Excluir organização' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationService.remove(id, user);
  }
}
