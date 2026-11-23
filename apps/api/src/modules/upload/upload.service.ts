import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { TenantPlanService } from '../../common/services/tenant-plan.service';

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


/** Pasta dos arquivos privados no disco (nao e servida como /uploads). */
const PRIVATE_DIR = path.join(process.cwd(), 'uploads-private');

/** Chave de arquivo privado sem truques de caminho (".." ou barra no inicio). */
function privateKey(key: string): string {
  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2 || parts.some((p) => p === '.' || p === '..' || p.includes('\\'))) {
    throw new BadRequestException('Arquivo inválido');
  }
  return parts.join('/');
}

/** Tipos aceitos no envio de arquivos e a extensao gravada para cada um. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/mpeg': '.mpeg',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
  'text/plain': '.txt',
};
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private storage: Storage | null;
  private bucket: string;
  private baseUrl: string;
  /** Bucket sem acesso publico para arquivos privados (vazio = disco local, fora do /uploads). */
  private privateBucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantPlan: TenantPlanService,
  ) {
    // Configuração do Google Cloud Storage
    const projectId = this.configService.get<string>('GCS_PROJECT_ID');
    const keyFilename = this.configService.get<string>('GCS_KEY_FILE');
    const credentials = this.configService.get<string>('GCS_CREDENTIALS');
    
    this.bucket = this.configService.get<string>('GCS_BUCKET') || 'crm-builder-uploads';
    this.privateBucket = this.configService.get<string>('GCS_PRIVATE_BUCKET') || '';
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

  /** Tipo aceito, ate 100 MB e espaco no plano (envio de arquivo pelo usuario). */
  async assertUploadable(file: Express.Multer.File | undefined, tenantId: string, skipStorageCheck = false): Promise<void> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    // Validar tipo de arquivo
    if (!EXTENSION_BY_MIME[file.mimetype]) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${file.mimetype}`,
      );
    }

    // Validar tamanho (máximo 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `Arquivo muito grande. Máximo permitido: ${maxSize / 1024 / 1024}MB`,
      );
    }

    if (!skipStorageCheck) await this.tenantPlan.assertCanAddStorage(tenantId, file.size);
  }

  async uploadFile(
    file: Express.Multer.File,
    tenantId: string,
    folder: string = 'uploads',
    // uploadMultipleFiles ja checou o lote inteiro.
    skipStorageCheck = false,
  ): Promise<UploadedFile> {
    await this.assertUploadable(file, tenantId, skipStorageCheck);

    // Extensao pelo tipo aceito, nunca pelo nome enviado: um .html declarado como
    // imagem vira .png e e servido como imagem.
    const ext = EXTENSION_BY_MIME[file.mimetype];
    const fileName = `${uuidv4()}${ext}`;
    const filePath = `${tenantId}/${folder}/${fileName}`;

    // Se GCS não está configurado, salvar localmente
    if (!this.storage) {
      this.logger.warn('GCS não configurado - salvando arquivo localmente');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', tenantId, folder);
      fs.mkdirSync(uploadsDir, { recursive: true });
      
      const localPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(localPath, file.buffer);
      await this.tenantPlan.addStorage(tenantId, file.size);

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
          // SVG aberto direto no navegador roda script: so baixa (em <img> continua aparecendo)
          ...(file.mimetype === 'image/svg+xml' ? { contentDisposition: 'attachment' } : {}),
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

      await this.tenantPlan.addStorage(tenantId, file.size);
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
    const total = files.reduce((sum, f) => sum + (f?.size ?? 0), 0);
    await this.tenantPlan.assertCanAddStorage(tenantId, total);
    return Promise.all(
      files.map((file) => this.uploadFile(file, tenantId, folder, true)),
    );
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.storage) {
      this.logger.warn('GCS não configurado - delete simulado');
      return;
    }

    try {
      const blob = this.storage.bucket(this.bucket).file(filePath);
      const [metadata] = await blob.getMetadata().catch(() => [{ size: 0 }] as const);
      await blob.delete();
      const tenantId = filePath.split('/')[0];
      if (tenantId) await this.tenantPlan.addStorage(tenantId, -Number(metadata.size ?? 0));
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

  // ── Arquivos privados ────────────────────────────────────────────────────
  // Anexos do chat, relatorios, PDFs gerados, arquivamento e auditoria: nunca ficam num
  // endereco publico. Vao para o bucket GCS_PRIVATE_BUCKET (sem acesso publico) ou para
  // uploads-private/ no disco (fora do /uploads servido pela API). A leitura passa por
  // uma rota que confere quem pede (ex.: GET /chat/channels/:id/messages/:mid/file).

  /** Grava um arquivo privado e devolve a chave (`<tenantId>/<pasta>/<nome>`). */
  async savePrivate(
    buffer: Buffer,
    opts: { tenantId: string; folder: string; mimeType: string; fileName?: string; countStorage?: boolean },
  ): Promise<{ key: string; size: number }> {
    const name = opts.fileName ?? `${uuidv4()}${EXTENSION_BY_MIME[opts.mimeType] ?? ''}`;
    const key = privateKey(`${opts.tenantId}/${opts.folder}/${name}`);
    if (this.storage && this.privateBucket) {
      await this.storage.bucket(this.privateBucket).file(key).save(buffer, {
        metadata: { contentType: opts.mimeType, metadata: { tenantId: opts.tenantId, uploadedAt: new Date().toISOString() } },
      });
    } else {
      const localPath = path.join(PRIVATE_DIR, key);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, buffer);
    }
    if (opts.countStorage !== false) await this.tenantPlan.addStorage(opts.tenantId, buffer.length);
    return { key, size: buffer.length };
  }

  /**
   * Le um arquivo PUBLICO guardado pelo proprio sistema (/uploads/... ou o bucket publico),
   * a partir do endereco gravado. Endereco de fora: null (nao busca URL arbitraria).
   */
  async readOwnPublic(url: string): Promise<Buffer | null> {
    let filePath: string | null = null;
    if (url.startsWith('/uploads/')) filePath = url.slice('/uploads/'.length);
    else if (url.startsWith(`${this.baseUrl}/`)) filePath = url.slice(this.baseUrl.length + 1);
    if (!filePath) return null;
    filePath = decodeURIComponent(filePath.split('?')[0]);
    if (filePath.split('/').some((part) => part === '..' || part === '')) return null;
    try {
      if (this.storage && !url.startsWith('/uploads/')) {
        const [buffer] = await this.storage.bucket(this.bucket).file(filePath).download();
        return buffer;
      }
      const localPath = path.join(process.cwd(), 'uploads', filePath);
      return fs.existsSync(localPath) ? fs.readFileSync(localPath) : null;
    } catch {
      return null;
    }
  }

  /** Le um arquivo privado pela chave. Quem chama ja conferiu se a pessoa pode ver. */
  async readPrivate(rawKey: string): Promise<Buffer> {
    const key = privateKey(rawKey);
    if (this.storage && this.privateBucket) {
      const [buffer] = await this.storage.bucket(this.privateBucket).file(key).download();
      return buffer;
    }
    const localPath = path.join(PRIVATE_DIR, key);
    if (!fs.existsSync(localPath)) throw new NotFoundException('Arquivo não encontrado');
    return fs.readFileSync(localPath);
  }

  /**
   * Upload de buffer direto (para PDFs gerados, etc.)
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    tenantId: string,
    folder: string = 'uploads',
  ): Promise<UploadedFile> {
    const filePath = `${tenantId}/${folder}/${fileName}`;

    if (!this.storage) {
      this.logger.warn('GCS não configurado - salvando buffer localmente');

      const uploadsDir = path.join(process.cwd(), 'uploads', tenantId, folder);
      fs.mkdirSync(uploadsDir, { recursive: true });

      const localPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(localPath, buffer);
      // Arquivos gerados pelo sistema (PDFs, backups) contam no uso, mas nao sao bloqueados.
      await this.tenantPlan.addStorage(tenantId, buffer.length);

      const publicUrl = `/uploads/${filePath}`;

      this.logger.log(`✅ Buffer salvo localmente: ${publicUrl}`);

      return {
        url: publicUrl,
        publicUrl,
        fileName,
        originalName: fileName,
        mimeType,
        size: buffer.length,
        bucket: 'local',
        path: filePath,
      };
    }

    try {
      const bucketInstance = this.storage.bucket(this.bucket);
      const blob = bucketInstance.file(filePath);

      await blob.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            tenantId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      try {
        await blob.makePublic();
      } catch (publicError) {
        this.logger.warn('Não foi possível tornar público individualmente (Uniform Bucket-Level Access ativado).');
      }

      await this.tenantPlan.addStorage(tenantId, buffer.length);
      const publicUrl = `${this.baseUrl}/${filePath}`;

      this.logger.log(`✅ Buffer enviado para GCS: ${publicUrl}`);

      return {
        url: publicUrl,
        publicUrl,
        fileName,
        originalName: fileName,
        mimeType,
        size: buffer.length,
        bucket: this.bucket,
        path: filePath,
      };
    } catch (error) {
      this.logger.error('Erro ao fazer upload de buffer:', error);
      throw new BadRequestException('Erro ao fazer upload do arquivo');
    }
  }

  /**
   * Soma o tamanho real de todos os arquivos do tenant (prefixo "{tenantId}/") e
   * grava no contador. Corrige o uso de arquivos anteriores ao contador.
   */
  async recomputeTenantStorage(tenantId: string): Promise<number> {
    let total = 0;
    if (!this.storage) {
      const root = path.join(process.cwd(), 'uploads', tenantId);
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else total += fs.statSync(full).size;
        }
      };
      walk(root);
    } else {
      const [files] = await this.storage.bucket(this.bucket).getFiles({ prefix: `${tenantId}/` });
      for (const f of files) total += Number(f.metadata.size ?? 0);
    }
    await this.tenantPlan.setStorageBytes(tenantId, total);
    return total;
  }

  /** Onde os arquivos ficam (para a tela de saude do console). */
  get storageMode(): { mode: 'gcs' | 'local'; bucket: string | null } {
    return this.storage ? { mode: 'gcs', bucket: this.bucket } : { mode: 'local', bucket: null };
  }

  /** Arquivos da empresa (prefixo "{tenantId}/"): caminho e tamanho, para a exportacao. */
  async listTenantFiles(tenantId: string): Promise<Array<{ path: string; bytes: number }>> {
    const out: Array<{ path: string; bytes: number }> = [];
    if (!this.storage) {
      const base = path.join(process.cwd(), 'uploads');
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else out.push({ path: path.relative(base, full).split(path.sep).join('/'), bytes: fs.statSync(full).size });
        }
      };
      walk(path.join(base, tenantId));
    } else {
      const [files] = await this.storage.bucket(this.bucket).getFiles({ prefix: `${tenantId}/` });
      for (const f of files) out.push({ path: f.name, bytes: Number(f.metadata.size ?? 0) });
    }
    return out;
  }

  /** Apaga TODOS os arquivos da empresa (exclusao definitiva da conta). */
  async deleteTenantFiles(tenantId: string): Promise<void> {
    if (!/^[a-z0-9]+$/i.test(tenantId)) throw new Error('tenantId invalido');
    if (!this.storage) {
      fs.rmSync(path.join(process.cwd(), 'uploads', tenantId), { recursive: true, force: true });
      return;
    }
    await this.storage.bucket(this.bucket).deleteFiles({ prefix: `${tenantId}/`, force: true });
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
