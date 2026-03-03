import {
  IsString,
  IsOptional,
  IsObject,
  IsInt,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFieldRuleDto {
  @ApiProperty({ example: 'status' })
  @IsString()
  fieldSlug: string;

  @ApiProperty({
    enum: ['required', 'visible', 'default', 'computed', 'validation'],
    example: 'required',
  })
  @IsString()
  @IsIn(['required', 'visible', 'default', 'computed', 'validation'])
  ruleType: string;

  @ApiPropertyOptional({ description: 'Condicao para aplicar a regra (null = sempre)' })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @ApiProperty({ description: 'Configuracao da regra baseada no ruleType' })
  @IsObject()
  config: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
