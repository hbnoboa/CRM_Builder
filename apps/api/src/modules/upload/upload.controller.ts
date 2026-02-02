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
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadService, UploadedFile as UploadedFileType } from './upload.service';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

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
    @CurrentUser() user: any,
    @Body('folder') folder?: string,
  ): Promise<UploadedFileType> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    return this.uploadService.uploadFile(file, user.tenantId, folder);
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
    @CurrentUser() user: any,
    @Body('folder') folder?: string,
  ): Promise<UploadedFileType[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    return this.uploadService.uploadMultipleFiles(files, user.tenantId, folder);
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
    @CurrentUser() user: any,
    @Body('folder') folder?: string,
  ): Promise<UploadedFileType> {
    if (!file) {
      throw new BadRequestException('Nenhuma imagem enviada');
    }
    return this.uploadService.uploadImage(file, user.tenantId, { folder });
  }

  @Delete(':path')
  @ApiOperation({ summary: 'Deletar arquivo' })
  async deleteFile(
    @Param('path') filePath: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    // Verificar se o arquivo pertence ao tenant
    if (!filePath.startsWith(user.tenantId)) {
      throw new BadRequestException('Você não tem permissão para deletar este arquivo');
    }
    
    await this.uploadService.deleteFile(filePath);
    return { message: 'Arquivo deletado com sucesso' };
  }
}
