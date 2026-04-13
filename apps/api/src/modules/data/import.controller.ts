import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser as CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { ProcessImportDto, ImportPreview, ImportProgress } from './dto/import-data.dto';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';

@Controller('data')
@ApiTags('Data Import')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ImportController {
  constructor(
    @InjectQueue('data-import') private readonly importQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload XLSX file and get preview
   */
  @Post(':entitySlug/import/upload')
  @ApiOperation({ summary: 'Upload XLSX e obter preview' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(xlsx|xls)$/)) {
        cb(new BadRequestException('Apenas arquivos .xlsx ou .xls são permitidos'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async uploadImport(
    @Param('entitySlug') entitySlug: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<ImportPreview> {
    // Verificar permissão
    checkModulePermission(user, 'entity_data', 'create');
    if (!file) {
      throw new BadRequestException('Arquivo não enviado');
    }

    // Verificar se entidade existe e usuário tem permissão
    const entity = await this.prisma.entity.findFirst({
      where: {
        slug: entitySlug,
        tenantId: user.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Entidade ${entitySlug} não encontrada`);
    }

    try {
      // Ler arquivo XLSX
      const workbook = XLSX.read(file.buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      if (rows.length === 0) {
        throw new BadRequestException('Arquivo vazio ou sem dados');
      }

      // Extrair headers (colunas do Excel)
      const headers = Object.keys(rows[0]);

      // Preview: primeiras 5 linhas
      const preview = rows.slice(0, 5);

      // Gerar ID único para este import
      const importId = uuid();

      // Salvar arquivo temporário em /tmp/imports/
      const uploadDir = path.join('/tmp', 'imports');
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, `${importId}.xlsx`);
      await fs.writeFile(filePath, file.buffer);

      return {
        importId,
        headers,
        preview,
        totalRows: rows.length,
        fileName: file.originalname,
      };
    } catch (error) {
      const err = error as Error;
      throw new BadRequestException(`Erro ao processar arquivo: ${err.message}`);
    }
  }

  /**
   * Process import in background queue
   */
  @Post(':entitySlug/import/process')
  @ApiOperation({ summary: 'Processar importação em background' })
  async processImport(
    @Param('entitySlug') entitySlug: string,
    @Body() dto: ProcessImportDto,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<{ jobId: string; message: string }> {
    // Verificar permissão
    checkModulePermission(user, 'entity_data', 'create');
    // Verificar se arquivo existe
    const filePath = path.join('/tmp', 'imports', `${dto.importId}.xlsx`);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Arquivo de importação não encontrado. Faça o upload novamente.');
    }

    // Verificar se entidade existe
    const entity = await this.prisma.entity.findFirst({
      where: {
        slug: entitySlug,
        tenantId: user.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Entidade ${entitySlug} não encontrada`);
    }

    // Validar fieldMapping
    if (!dto.fieldMapping || Object.keys(dto.fieldMapping).length === 0) {
      throw new BadRequestException('Mapeamento de campos é obrigatório');
    }

    // Adicionar job na fila
    const job = await this.importQueue.add({
      importId: dto.importId,
      entitySlug,
      fieldMapping: dto.fieldMapping,
      userId: user.id,
      tenantId: user.tenantId,
      userName: user.name,
    });

    return {
      jobId: job.id.toString(),
      message: 'Importação adicionada à fila. Você receberá notificações do progresso.',
    };
  }

  /**
   * Get import status/progress
   */
  @Get('import/status/:importId')
  @ApiOperation({ summary: 'Obter status da importação' })
  async getImportStatus(
    @Param('importId') importId: string,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<ImportProgress> {
    // Buscar job na fila
    const jobs = await this.importQueue.getJobs(['active', 'waiting', 'completed', 'failed']);
    const job = jobs.find((j) => j.data.importId === importId && j.data.userId === user.id);

    if (!job) {
      throw new NotFoundException('Importação não encontrada');
    }

    const state = await job.getState();
    const progress = await job.progress();
    const result = job.returnvalue as { imported: number; errors: number } | undefined;

    let status: ImportProgress['status'];
    if (state === 'waiting') status = 'queued';
    else if (state === 'active') status = 'processing';
    else if (state === 'completed') status = 'completed';
    else if (state === 'failed') status = 'failed';
    else status = 'queued';

    return {
      importId,
      status,
      progress: typeof progress === 'number' ? progress : 0,
      imported: result?.imported ?? 0,
      errors: result?.errors ?? 0,
      total: 0, // Total não disponível até processar
      reportUrl: result && result.errors > 0 ? `/data/import/report/${importId}` : undefined,
    };
  }

  /**
   * Download error report CSV
   */
  @Get('import/report/:importId')
  @ApiOperation({ summary: 'Baixar relatório de erros' })
  async getErrorReport(
    @Param('importId') importId: string,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<StreamableFile> {
    const reportPath = path.join('/tmp', 'import-reports', `${importId}-errors.csv`);

    try {
      await fs.access(reportPath);
    } catch {
      throw new NotFoundException('Relatório de erros não encontrado');
    }

    // Verificar se o import pertence ao usuário (buscar job)
    const jobs = await this.importQueue.getJobs(['completed', 'failed']);
    const job = jobs.find((j) => j.data.importId === importId && j.data.userId === user.id);

    if (!job) {
      throw new NotFoundException('Relatório não encontrado ou acesso negado');
    }

    const file = createReadStream(reportPath);
    return new StreamableFile(file, {
      type: 'text/csv',
      disposition: `attachment; filename="${importId}-errors.csv"`,
    });
  }
}
