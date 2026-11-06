import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class AiMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class AiProposeDto {
  @ApiProperty({ type: [AiMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AiMessageDto)
  messages: AiMessageDto[];

  @ApiPropertyOptional({ description: 'Proposta atual (devolvida pela chamada anterior)' })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  currentProposal?: Record<string, unknown>;
}

export class AiApplyDto {
  @ApiProperty({ description: 'Proposta devolvida por /ai-builder/propose' })
  @IsObject()
  @Type(() => Object)
  proposal: Record<string, unknown>;
}
