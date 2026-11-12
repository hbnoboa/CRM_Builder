import { IsString, IsOptional, IsEnum, IsEmail, MinLength, MaxLength, Matches, ValidateIf, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  @ApiProperty({ example: 'Empresa ABC' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'empresa-abc' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'empresa-abc.crmbuilder.com' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logo?: string;

  // Admin inicial (OPCIONAL - se nao informado, apenas cria o tenant com roles de sistema)
  @ApiPropertyOptional({ example: 'admin@empresa.com', description: 'Email do primeiro usuario admin (opcional)' })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiPropertyOptional({ example: 'Admin da Empresa', description: 'Nome do primeiro usuario admin (opcional)' })
  @IsString()
  @IsOptional()
  adminName?: string;

  @ApiPropertyOptional({ example: 'Senha123!', description: 'Senha do primeiro usuario admin (opcional)' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @IsOptional()
  adminPassword?: string;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({ enum: Status })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: Record<string, any>;
}

export class QueryTenantDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: Status })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'Membro ativo, num cargo com acesso total' })
  @IsString()
  userId: string;
}

/** Organizacao editada pelo admin da empresa (slug e dominio ficam com o suporte). */
export class UpdateMyTenantDto {
  @ApiPropertyOptional({ example: 'Minha Empresa Ltda' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome da empresa deve ter no minimo 2 caracteres' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ nullable: true, description: 'URL do logo (upload em /upload/image); null remove' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(500)
  @Matches(/^(https?:\/\/|\/uploads\/)/, { message: 'Logo deve ser uma URL de imagem enviada pelo sistema' })
  logo?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '#7c3aed', description: 'Cor da marca; null volta ao padrao' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Cor deve estar no formato #RRGGBB' })
  brandColor?: string | null;

  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  darkMode?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional({ description: 'Permite que a IA do chat leia o conteudo de um registro quando alguem pede (resumos e textos)' })
  @IsOptional()
  @IsBoolean()
  aiReadRecords?: boolean;
}
