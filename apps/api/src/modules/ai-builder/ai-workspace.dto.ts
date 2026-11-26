import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiWorkspacePreviewDto {
  @ApiProperty({ description: 'Rascunho do construtor (o que mudou)' })
  @IsObject()
  @Type(() => Object)
  proposal: Record<string, unknown>;
}

export class AiWorkspaceApplyDto extends AiWorkspacePreviewDto {
  @ApiPropertyOptional({ description: 'A pessoa confirmou as exclusões do rascunho' })
  @IsOptional()
  @IsBoolean()
  confirmRemovals?: boolean;

  @ApiPropertyOptional({ description: 'O que a pessoa pediu na conversa (fica no histórico)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  conversation?: string[];
}

export class AiWorkspacePdfPreviewDto extends AiWorkspacePreviewDto {
  @ApiProperty({ description: 'Chave do PDF no rascunho' })
  @IsString()
  @MaxLength(100)
  key: string;
}
