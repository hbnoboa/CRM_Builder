import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { DataService, QueryDataDto } from './data.service';
import { DataIoService } from './data-io.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

@ApiTags('Data')
@Controller('data')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DataController {
  constructor(
    private readonly dataService: DataService,
    private readonly dataIoService: DataIoService,
  ) {}

  // Export/Import endpoints BEFORE :entitySlug/:id to avoid route conflicts

  @Get(':entitySlug/export')
  @ApiOperation({ summary: 'Exportar dados' })
  async exportData(
    @Param('entitySlug') entitySlug: string,
    @Query() query: QueryDataDto,
    @Query('format') format: string,
    @CurrentUser() user: CurrentUserType,
    @Res({ passthrough: true }) res: Response,
  ) {
    const exportFormat = format === 'json' ? 'json' : 'xlsx';
    const result = await this.dataIoService.exportData(entitySlug, query, exportFormat, user);

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });

    return new StreamableFile(result.buffer);
  }

  @Post(':entitySlug/import/preview')
  @ApiOperation({ summary: 'Preview do arquivo para importacao' })
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(
    @Param('entitySlug') entitySlug: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
    @Query('sheetName') sheetName: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.dataIoService.previewImport(entitySlug, file, user, tenantId, sheetName);
  }

  @Post(':entitySlug/import')
  @ApiOperation({ summary: 'Importar dados' })
  @UseInterceptors(FileInterceptor('file'))
  async importData(
    @Param('entitySlug') entitySlug: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
    @Body() body: { columnMapping?: Record<string, string>; sheetName?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    // columnMapping and sheetName come as JSON strings from multipart/form-data
    const parsedMapping = typeof body?.columnMapping === 'string'
      ? JSON.parse(body.columnMapping)
      : body?.columnMapping;
    const sheet = typeof body?.sheetName === 'string' ? body.sheetName : undefined;
    return this.dataIoService.importData(entitySlug, file, user, tenantId, parsedMapping, sheet);
  }

  @Post(':entitySlug')
  @ApiOperation({ summary: 'Criar registro' })
  async create(
    @Param('entitySlug') entitySlug: string,
    @Body() dto: { data: Record<string, any>; parentRecordId?: string; tenantId?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.dataService.create(entitySlug, dto, user);
  }

  @Get(':entitySlug')
  @ApiOperation({ summary: 'Listar registros' })
  async findAll(
    @Param('entitySlug') entitySlug: string,
    @Query() query: QueryDataDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.dataService.findAll(entitySlug, query, user);
  }

  @Get(':entitySlug/:id')
  @ApiOperation({ summary: 'Buscar registro por ID' })
  async findOne(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.dataService.findOne(entitySlug, id, user, tenantId);
  }

  @Patch(':entitySlug/:id')
  @ApiOperation({ summary: 'Atualizar registro' })
  async update(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Body() dto: { data: Record<string, any>; tenantId?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.dataService.update(entitySlug, id, dto, user);
  }

  @Delete(':entitySlug/:id')
  @ApiOperation({ summary: 'Excluir registro' })
  async remove(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.dataService.remove(entitySlug, id, user, tenantId);
  }
}
