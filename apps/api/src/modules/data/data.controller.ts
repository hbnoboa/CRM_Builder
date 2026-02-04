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

  @Post(':entitySlug')
  @ApiOperation({ summary: 'Criar registro' })
  async create(
    @Param('entitySlug') entitySlug: string,
    @Body() dto: { data: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    return this.dataService.create(entitySlug, dto, user);
  }

  @Get(':entitySlug')
  @ApiOperation({ summary: 'Listar registros' })
  async findAll(
    @Param('entitySlug') entitySlug: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    return this.dataService.findAll(entitySlug, query, user);
  }

  @Get(':entitySlug/:id')
  @ApiOperation({ summary: 'Buscar registro por ID' })
  async findOne(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dataService.findOne(entitySlug, id, user);
  }

  @Patch(':entitySlug/:id')
  @ApiOperation({ summary: 'Atualizar registro' })
  async update(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Body() dto: { data: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    return this.dataService.update(entitySlug, id, dto, user);
  }

  @Delete(':entitySlug/:id')
  @ApiOperation({ summary: 'Excluir registro' })
  async remove(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dataService.remove(entitySlug, id, user);
  }
}
