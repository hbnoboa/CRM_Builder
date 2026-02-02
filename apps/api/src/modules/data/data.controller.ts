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
import { DataService } from './data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Data')
@Controller('data')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post(':workspaceId/:entitySlug')
  @ApiOperation({ summary: 'Criar registro' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Param('entitySlug') entitySlug: string,
    @Body() dto: { data: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    return this.dataService.create(entitySlug, workspaceId, dto, user);
  }

  @Get(':workspaceId/:entitySlug')
  @ApiOperation({ summary: 'Listar registros' })
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('entitySlug') entitySlug: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    return this.dataService.findAll(entitySlug, workspaceId, query, user);
  }

  @Get(':workspaceId/:entitySlug/:id')
  @ApiOperation({ summary: 'Buscar registro por ID' })
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dataService.findOne(entitySlug, workspaceId, id, user);
  }

  @Put(':workspaceId/:entitySlug/:id')
  @ApiOperation({ summary: 'Atualizar registro' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Body() dto: { data: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    return this.dataService.update(entitySlug, workspaceId, id, dto, user);
  }

  @Delete(':workspaceId/:entitySlug/:id')
  @ApiOperation({ summary: 'Excluir registro' })
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dataService.remove(entitySlug, workspaceId, id, user);
  }
}
