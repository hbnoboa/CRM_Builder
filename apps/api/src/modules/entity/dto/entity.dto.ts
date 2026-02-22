import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateColumnConfigDto {
  @ApiProperty({ description: 'Slugs dos campos visiveis na ordem desejada' })
  @IsArray()
  @IsString({ each: true })
  visibleColumns: string[];
}
