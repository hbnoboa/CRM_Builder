import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAutomationDto {
  @ApiProperty({ example: 'Notificar ao criar lead' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Envia notificacao quando um lead e criado' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: [
      'ON_CREATE',
      'ON_UPDATE',
      'ON_DELETE',
      'ON_FIELD_CHANGE',
      'ON_STATUS_CHANGE',
      'SCHEDULE',
      'MANUAL',
    ],
    example: 'ON_CREATE',
  })
  @IsString()
  trigger: string;

  @ApiPropertyOptional({
    description:
      'Configuracao do trigger. Ex: ON_FIELD_CHANGE: { fieldSlug, fromValue?, toValue? }, SCHEDULE: { cronExpression, timezone }',
    example: { cronExpression: '0 9 * * *', timezone: 'America/Sao_Paulo' },
  })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Condicoes para execucao (AND logico)',
    example: [{ field: 'status', operator: 'eq', value: 'active' }],
  })
  @IsOptional()
  @IsArray()
  conditions?: Array<Record<string, unknown>>;

  @ApiProperty({
    type: [Object],
    description: 'Acoes sequenciais a serem executadas',
    example: [
      {
        order: 0,
        type: 'notify_user',
        config: { title: 'Novo Lead', message: 'Lead {{record.name}} criado' },
      },
    ],
  })
  @IsArray()
  actions: Array<Record<string, unknown>>;

  @ApiPropertyOptional({
    default: 'stop',
    description: 'Comportamento em caso de erro: stop ou continue',
  })
  @IsOptional()
  @IsString()
  errorHandling?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxExecutionsPerHour?: number;
}
