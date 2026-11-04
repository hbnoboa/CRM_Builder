import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { TenantLifecycle } from '@prisma/client';
import { BULK_ACTIONS, BULK_MAX, type BulkAction } from '../platform-bulk.service';

export class PlatformBulkDto {
  @ApiProperty({ enum: BULK_ACTIONS })
  @IsIn([...BULK_ACTIONS])
  action: BulkAction;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(BULK_MAX) @IsString({ each: true })
  tenantIds?: string[];

  @ApiPropertyOptional({ description: "Todas as empresas deste plano ('none' = sem plano)" })
  @IsOptional() @IsString()
  fromPlanId?: string;

  @ApiPropertyOptional({ description: 'Plano de destino (null = sem plano)' })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  planId?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1) @Max(365)
  days?: number;

  @ApiPropertyOptional({ enum: TenantLifecycle })
  @IsOptional() @IsEnum(TenantLifecycle)
  lifecycle?: TenantLifecycle;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  dryRun?: boolean;
}
