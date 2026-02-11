import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { ROLE_TYPES, RoleType } from '../../custom-role/dto/custom-role.dto';

export class CreateUserDto {
  @ApiProperty({ example: 'usuario@empresa.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6, { message: 'Senha deve ter no minimo 6 caracteres' })
  password: string;

  @ApiProperty({ example: 'Joao Silva' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Tenant ID (apenas PLATFORM_ADMIN pode especificar)' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ description: 'ID da role customizada (obrigatorio)' })
  @IsString()
  customRoleId: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ enum: Status })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}

export class QueryUserDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor para paginacao (melhor para listas grandes)' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filtrar por roleType', enum: ROLE_TYPES })
  @IsIn(ROLE_TYPES)
  @IsOptional()
  role?: RoleType;

  @ApiPropertyOptional({ enum: Status })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional({ description: 'Filtrar por tenant (apenas PLATFORM_ADMIN)' })
  @IsString()
  @IsOptional()
  tenantId?: string;
}
