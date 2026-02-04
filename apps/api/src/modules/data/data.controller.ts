import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataService } from './data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Data')
@Controller('data')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post(':organizationId/:entitySlug')
  @ApiOperation({ summary: 'Criar registro' })
  async create(
    @Param('organizationId') organizationId: string,
    @Param('entitySlug') entitySlug: string,
    @Body() dto: { data: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    return this.dataService.create(entitySlug, organizationId, dto, user);
  }

  @Get(':organizationId/:entitySlug')
  @ApiOperation({ summary: 'Listar registros' })
  async findAll(
    @Param('organizationId') organizationId: string,
    @Param('entitySlug') entitySlug: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    return this.dataService.findAll(entitySlug, organizationId, query, user);
  }

  @Get(':organizationId/:entitySlug/:id')
  @ApiOperation({ summary: 'Buscar registro por ID' })
  async findOne(
    @Param('organizationId') organizationId: string,
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dataService.findOne(entitySlug, organizationId, id, user);
  }

  @Patch(':organizationId/:entitySlug/:id')
  @ApiOperation({ summary: 'Atualizar registro' })
  async update(
    @Param('organizationId') organizationId: string,
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Body() dto: { data: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    return this.dataService.update(entitySlug, organizationId, id, dto, user);
  }

  @Delete(':organizationId/:entitySlug/:id')
  @ApiOperation({ summary: 'Excluir registro' })
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dataService.remove(entitySlug, organizationId, id, user);
  }
}
