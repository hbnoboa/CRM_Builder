import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchTenantDto {
  @ApiProperty({ description: 'ID do tenant destino' })
  @IsString()
  tenantId: string;
}
