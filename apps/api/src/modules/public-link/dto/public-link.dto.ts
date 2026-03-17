import { IsString, IsOptional, IsBoolean, IsDateString, IsInt, MinLength, MaxLength, IsEmail, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePublicLinkDto {
  @ApiProperty({ example: 'Inspecao de Caminhoes' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'inspecao-caminhao', description: 'Slug da entidade alvo' })
  @IsString()
  entitySlug: string;

  @ApiPropertyOptional({ description: 'ID da role. Se nao informado, cria automaticamente.' })
  @IsString()
  @IsOptional()
  customRoleId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Maximo de usuarios que podem se registrar' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxUsers?: number;
}

export class UpdatePublicLinkDto extends PartialType(CreatePublicLinkDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PublicRegisterDto {
  @ApiProperty({ example: 'Joao Silva' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty({ example: 'Senha123!' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsString()
  @IsOptional()
  cpf?: string;

  @ApiPropertyOptional({ example: '12345678000199' })
  @IsString()
  @IsOptional()
  cnpj?: string;

  @ApiPropertyOptional({ example: '11999991234' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class PublicLoginDto {
  @ApiProperty({ example: 'joao@email.com', description: 'Email, CPF ou telefone' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'Senha123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class QueryPublicLinkDto {
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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entitySlug?: string;
}
