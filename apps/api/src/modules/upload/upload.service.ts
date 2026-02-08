import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

export interface UploadedFile {
  url: string;
  publicUrl: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
  path: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private storage: Storage | null;
  private bucket: string;
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Configuração do Google Cloud Storage
    const projectId = this.configService.get<string>('GCS_PROJECT_ID');
    const keyFilename = this.configService.get<string>('GCS_KEY_FILE');
    const credentials = this.configService.get<string>('GCS_CREDENTIALS');
    
    this.bucket = this.configService.get<string>('GCS_BUCKET') || 'crm-builder-uploads';
    this.baseUrl = this.configService.get<string>('GCS_BASE_URL') || 
      `https://storage.googleapis.com/${this.bucket}`;

    try {
      if (credentials) {
        // Usar credenciais do JSON string (para produção)
        this.storage = new Storage({
          projectId,
          credentials: JSON.parse(credentials),
        });
      } else if (keyFilename) {
        // Usar arquivo de chave (para desenvolvimento local)
        this.storage = new Storage({
          projectId,
          keyFilename,
        });
      } else {
        // Fallback - modo mock para desenvolvimento sem GCS
        this.logger.warn('Google Cloud Storage nao configurado. Usando modo local.');
        this.storage = null;
      }
    } catch (error) {
      this.logger.error('Erro ao configurar Google Cloud Storage:', error);
      this.storage = null;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    tenantId: string,
    folder: string = 'uploads',
  ): Promise<UploadedFile> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    // Validar tipo de arquivo
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${file.mimetype}`,
      );
    }

    // Validar tamanho (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `Arquivo muito grande. Máximo permitido: ${maxSize / 1024 / 1024}MB`,
      );
    }

    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const filePath = `${tenantId}/${folder}/${fileName}`;

    // Se GCS não está configurado, salvar localmente
    if (!this.storage) {
      this.logger.warn('GCS não configurado - salvando arquivo localmente');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', tenantId, folder);
      fs.mkdirSync(uploadsDir, { recursive: true });
      
      const localPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(localPath, file.buffer);
      
      const publicUrl = `/uploads/${filePath}`;
      
      this.logger.log(`✅ Arquivo salvo localmente: ${publicUrl}`);
      
      return {
        url: publicUrl,
        publicUrl,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: 'local',
        path: filePath,
      };
    }

    try {
      const bucketInstance = this.storage.bucket(this.bucket);
      const blob = bucketInstance.file(filePath);

      await blob.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            tenantId,
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Tentar tornar arquivo público (pode falhar com Uniform Bucket-Level Access)
      try {
        await blob.makePublic();
      } catch (publicError) {
        this.logger.warn(`Não foi possível tornar público individualmente (Uniform Bucket-Level Access ativado). Configure o bucket como público via IAM.`);
      }

      const publicUrl = `${this.baseUrl}/${filePath}`;

      this.logger.log(`✅ Arquivo enviado: ${publicUrl}`);

      return {
        url: publicUrl,
        publicUrl,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: this.bucket,
        path: filePath,
      };
    } catch (error) {
      this.logger.error('Erro ao fazer upload:', error);
      throw new BadRequestException('Erro ao fazer upload do arquivo');
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    tenantId: string,
    folder: string = 'uploads',
  ): Promise<UploadedFile[]> {
    return Promise.all(
      files.map((file) => this.uploadFile(file, tenantId, folder)),
    );
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.storage) {
      this.logger.warn('GCS não configurado - delete simulado');
      return;
    }

    try {
      await this.storage.bucket(this.bucket).file(filePath).delete();
      this.logger.log(`✅ Arquivo deletado: ${filePath}`);
    } catch (error) {
      this.logger.error('Erro ao deletar arquivo:', error);
      throw new BadRequestException('Erro ao deletar arquivo');
    }
  }

  async getSignedUrl(
    filePath: string,
    expiresInMinutes: number = 60,
  ): Promise<string> {
    if (!this.storage) {
      return `/uploads/${filePath}`;
    }

    try {
      const [url] = await this.storage
        .bucket(this.bucket)
        .file(filePath)
        .getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresInMinutes * 60 * 1000,
        });

      return url;
    } catch (error) {
      this.logger.error('Erro ao gerar URL assinada:', error);
      throw new BadRequestException('Erro ao gerar URL assinada');
    }
  }

  // Upload de imagem com redimensionamento (requer sharp)
  async uploadImage(
    file: Express.Multer.File,
    tenantId: string,
    options?: {
      folder?: string;
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    },
  ): Promise<UploadedFile> {
    const imageMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!imageMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Arquivo deve ser uma imagem válida');
    }

    // Aqui você pode usar sharp para redimensionar a imagem se necessário
    // Por simplicidade, vamos apenas fazer upload diretamente
    return this.uploadFile(file, tenantId, options?.folder || 'images');
  }
}
