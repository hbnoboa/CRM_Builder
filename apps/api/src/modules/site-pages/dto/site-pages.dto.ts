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

  @ApiPropertyOptional({ description: 'Secoes e posicao de cada bloco na grade' })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Aparencia: estilo, fundo, cor de destaque, capa, frase' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class PreviewSitePageDto {
  @ApiProperty()
  @IsArray()
  @Type(() => Object)
  blocks: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Secoes e posicao de cada bloco na grade' })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Endereco da pagina (marca o item atual no menu)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

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

  @ApiPropertyOptional({ description: 'Valores do registro de cima (ex.: segurado), quando o formulario e de uma tabela de dentro' })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  parentData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Campo escondido (anti-robo); pessoas deixam vazio' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class UpdateSiteDto {
  @ApiPropertyOptional({ description: 'Aparencia padrao das paginas' })
  @IsOptional()
  @IsObject()
  look?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Paginas do menu, na ordem: [{ slug, label? }]' })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  menu?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Rodape: texto, endereco, horarios, telefone, whatsapp, instagram, email' })
  @IsOptional()
  @IsObject()
  footer?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  homeSlug?: string;
}
