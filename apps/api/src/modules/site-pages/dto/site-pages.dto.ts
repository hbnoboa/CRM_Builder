import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSitePageDto {
  @ApiProperty({ example: 'Avise seu sinistro' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ enum: ['form', 'tracking', 'blank'] })
  @IsOptional()
  @IsIn(['form', 'tracking', 'blank'])
  template?: 'form' | 'tracking' | 'blank';

  @ApiPropertyOptional({ description: 'Tabela do formulario ou do acompanhamento' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entitySlug?: string;
}

export class UpdateSitePageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Blocos da pagina (validados no servidor)' })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  blocks?: Record<string, unknown>[];
}

export class PreviewSitePageDto {
  @ApiProperty()
  @IsArray()
  @Type(() => Object)
  blocks: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class PublishSitePageDto {
  @ApiProperty()
  @IsBoolean()
  publish: boolean;
}

export class TrackingLinkDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  entitySlug: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  recordId: string;
}

export class SubmitSiteFormDto {
  @ApiProperty({ description: 'Valores do formulario por campo' })
  @IsObject()
  @Type(() => Object)
  data: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Campo escondido (anti-robo); pessoas deixam vazio' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
