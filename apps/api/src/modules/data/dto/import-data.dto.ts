import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessImportDto {
  @ApiProperty({ description: 'ID do arquivo importado (retornado no upload)' })
  @IsString()
  importId: string;

  @ApiProperty({
    description: 'Mapeamento de colunas Excel para campos da entidade',
    example: { 'Nome': 'name', 'Email': 'email', 'Telefone': 'phone' },
  })
  @IsObject()
  fieldMapping: Record<string, string>;

  @ApiProperty({ description: 'Tenant ID (opcional para PLATFORM_ADMIN)', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export interface ImportPreview {
  importId: string;
  headers: string[];
  preview: Record<string, unknown>[];
  totalRows: number;
  fileName: string;
}

export interface ImportProgress {
  importId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  imported: number;
  errors: number;
  total: number;
  errorDetails?: ImportError[];
  reportUrl?: string;
}

export interface ImportError {
  row: number;
  data: Record<string, unknown>;
  error: string;
}
