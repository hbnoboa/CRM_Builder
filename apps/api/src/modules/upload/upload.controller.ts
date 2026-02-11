import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Param,
  Query,
  Body,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as pathModule from 'path';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { UploadService, UploadedFile as UploadedFileType } from './upload.service';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /** Sanitiza folder para prevenir path traversal */
  private sanitizeFolder(folder?: string): string | undefined {
    if (!folder) return undefined;
    // Remove ../ e normaliza o path
    const sanitized = pathModule.normalize(folder).replace(/^(\.\.(\/|\\|$))+/, '');
    // Rejeita se ainda contiver ..
    if (sanitized.includes('..')) {
      throw new BadRequestException('Caminho de pasta invalido');
    }
    return sanitized;
  }

  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload de arquivo único' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'Pasta de destino (opcional)',
        },
      },
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserType,
    @Body('folder') folder?: string,
  ): Promise<UploadedFileType> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const safeFolder = this.sanitizeFolder(folder);
    return this.uploadService.uploadFile(file, user.tenantId, safeFolder);
  }

  @Post('files')
  @UseInterceptors(FilesInterceptor('files', 10)) // máximo 10 arquivos
  @ApiOperation({ summary: 'Upload de múltiplos arquivos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folder: {
          type: 'string',
          description: 'Pasta de destino (opcional)',
        },
      },
    },
  })
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
    @Body('folder') folder?: string,
  ): Promise<UploadedFileType[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const safeFolder = this.sanitizeFolder(folder);
    return this.uploadService.uploadMultipleFiles(files, user.tenantId, safeFolder);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload de imagem' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'Pasta de destino (opcional)',
        },
      },
    },
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserType,
    @Body('folder') folder?: string,
  ): Promise<UploadedFileType> {
    if (!file) {
      throw new BadRequestException('Nenhuma imagem enviada');
    }
    const safeFolder = this.sanitizeFolder(folder);
    return this.uploadService.uploadImage(file, user.tenantId, { folder: safeFolder });
  }

  @Delete(':path')
  @ApiOperation({ summary: 'Deletar arquivo' })
  async deleteFile(
    @Param('path') filePath: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<{ message: string }> {
    // Normalizar path para prevenir path traversal (../)
    const normalizedPath = pathModule.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');

    // Verificar se o arquivo pertence ao tenant apos normalizacao
    if (!normalizedPath.startsWith(user.tenantId)) {
      throw new ForbiddenException('Voce nao tem permissao para deletar este arquivo');
    }

    await this.uploadService.deleteFile(normalizedPath);
    return { message: 'Arquivo deletado com sucesso' };
  }
}
